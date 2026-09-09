<?php

namespace App\Controllers;

use App\Support\Audit;
use App\Support\Database;
use App\Support\Http;
use Exception;
use PDO;

// Mirrors the paper Fulfillment sheet: Fulfillment (OUT) vs RTS per
// product/unit for a given day. GET computes it live; POST persists a snapshot.
class FulfillmentController
{
    private function computeRollup(PDO $pdo, string $date): array
    {
        $out = $pdo->prepare(
            "SELECT oi.product_id, oi.unit_id, SUM(oi.quantity) AS qty_out
             FROM ospr_order_items oi JOIN ospr_batches b ON b.id = oi.batch_id
             WHERE b.batch_date = :d GROUP BY oi.product_id, oi.unit_id"
        );
        $out->execute([':d' => $date]);
        $outMap = [];
        foreach ($out->fetchAll() as $r) { $outMap[$r['product_id'] . '-' . $r['unit_id']] = (float)$r['qty_out']; }

        $rts = $pdo->prepare(
            "SELECT product_id, unit_id, SUM(quantity) AS qty_rts FROM rts_triage
             WHERE DATE(logged_at) = :d GROUP BY product_id, unit_id"
        );
        $rts->execute([':d' => $date]);
        $rtsMap = [];
        foreach ($rts->fetchAll() as $r) { $rtsMap[$r['product_id'] . '-' . $r['unit_id']] = (float)$r['qty_rts']; }

        $keys = array_unique(array_merge(array_keys($outMap), array_keys($rtsMap)));
        $items = [];
        foreach ($keys as $k) {
            [$pid, $uid] = explode('-', $k);
            $items[] = [
                'product_id' => (int)$pid, 'unit_id' => (int)$uid,
                'qty_out' => $outMap[$k] ?? 0, 'qty_rts' => $rtsMap[$k] ?? 0,
            ];
        }

        $parcels = $pdo->prepare(
            "SELECT COUNT(DISTINCT oi.code_name) AS total_parcel, COUNT(DISTINCT b.packed_by) AS total_packers
             FROM ospr_order_items oi JOIN ospr_batches b ON b.id = oi.batch_id WHERE b.batch_date = :d"
        );
        $parcels->execute([':d' => $date]);
        $p = $parcels->fetch();

        return [
            'date' => $date,
            'total_parcel' => (int)($p['total_parcel'] ?? 0),
            'total_packers' => (int)($p['total_packers'] ?? 0),
            'items' => $items,
        ];
    }

    public function index(): void
    {
        $pdo = Database::pdo();

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $date = $_GET['date'] ?? date('Y-m-d');
            $rollup = $this->computeRollup($pdo, $date);

            // Attach display names for convenience.
            $nameStmt = $pdo->prepare(
                "SELECT p.name AS product_name, u.code AS unit_code FROM products p, units u
                 WHERE p.id = :p AND u.id = :u"
            );
            foreach ($rollup['items'] as &$item) {
                $nameStmt->execute([':p' => $item['product_id'], ':u' => $item['unit_id']]);
                $n = $nameStmt->fetch();
                $item['product_name'] = $n['product_name'] ?? null;
                $item['unit_code'] = $n['unit_code'] ?? null;
            }
            Http::sendJson($rollup);
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $data = Http::jsonInput();
            Http::requireFields($data, ['date']);
            $rollup = $this->computeRollup($pdo, $data['date']);

            $pdo->beginTransaction();
            try {
                $pdo->prepare(
                    'INSERT INTO fulfillment_daily (summary_date, total_parcel, total_packers)
                     VALUES (:d, :tp, :tk)
                     ON DUPLICATE KEY UPDATE total_parcel = VALUES(total_parcel), total_packers = VALUES(total_packers),
                       generated_at = NOW()'
                )->execute([':d' => $rollup['date'], ':tp' => $rollup['total_parcel'], ':tk' => $rollup['total_packers']]);

                $fdId = (int)$pdo->query(
                    'SELECT id FROM fulfillment_daily WHERE summary_date = ' . $pdo->quote($rollup['date'])
                )->fetch()['id'];

                $itemStmt = $pdo->prepare(
                    'INSERT INTO fulfillment_daily_items (fulfillment_daily_id, product_id, unit_id, qty_out, qty_rts)
                     VALUES (:f, :p, :u, :o, :r)
                     ON DUPLICATE KEY UPDATE qty_out = VALUES(qty_out), qty_rts = VALUES(qty_rts)'
                );
                foreach ($rollup['items'] as $item) {
                    $itemStmt->execute([
                        ':f' => $fdId, ':p' => $item['product_id'], ':u' => $item['unit_id'],
                        ':o' => $item['qty_out'], ':r' => $item['qty_rts'],
                    ]);
                }
                $pdo->commit();
                Audit::log('GENERATE_FULFILLMENT_SUMMARY', 'fulfillment_daily', $fdId, ['date' => $rollup['date']]);
                Http::sendJson(['success' => true, 'id' => $fdId, 'rollup' => $rollup], 201);
            } catch (Exception $e) {
                $pdo->rollBack();
                Http::sendError('Failed to persist summary: ' . $e->getMessage(), 500);
            }
        }

        Http::methodNotAllowed();
    }
}
