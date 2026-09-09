<?php

namespace App\Controllers\Ospr;

use App\Support\Audit;
use App\Support\Database;
use App\Support\Http;
use Exception;

// Closes the batch: sets packed_by/time_ended and auto-computes the
// Accomplishment Report totals from the logged items - no manual add-up.
class CloseController
{
    public function close(): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') Http::methodNotAllowed();
        $pdo = Database::pdo();

        $data = Http::jsonInput();
        Http::requireFields($data, ['batch_id']);

        $pdo->beginTransaction();
        try {
            $batch = $pdo->prepare('SELECT * FROM ospr_batches WHERE id = :id FOR UPDATE');
            $batch->execute([':id' => $data['batch_id']]);
            $b = $batch->fetch();
            if (!$b) { $pdo->rollBack(); Http::sendError('Batch not found', 404); }
            if ($b['status'] === 'CLOSED') { $pdo->rollBack(); Http::sendError('Batch already closed', 409); }

            $pdo->prepare(
                'UPDATE ospr_batches SET packed_by = :pb, time_ended = :te, status = "CLOSED" WHERE id = :id'
            )->execute([
                ':pb' => $data['packed_by'] ?? null,
                ':te' => $data['time_ended'] ?? date('H:i:s'),
                ':id' => $data['batch_id'],
            ]);

            // Totals per unit code, straight from the logged order items.
            $sums = $pdo->prepare(
                "SELECT u.code, SUM(oi.quantity) AS total
                 FROM ospr_order_items oi JOIN units u ON u.id = oi.unit_id
                 WHERE oi.batch_id = :b GROUP BY u.code"
            );
            $sums->execute([':b' => $data['batch_id']]);
            $byUnit = ['GAL' => 0, 'LIT' => 0, '750ML' => 0, '350ML' => 0, 'KG' => 0];
            foreach ($sums->fetchAll() as $row) { $byUnit[$row['code']] = (float)$row['total']; }

            $totals = $pdo->prepare(
                "SELECT COUNT(*) AS pcs, COUNT(DISTINCT code_name) AS parcels
                 FROM ospr_order_items WHERE batch_id = :b"
            );
            $totals->execute([':b' => $data['batch_id']]);
            $t = $totals->fetch();

            $pdo->prepare(
                'INSERT INTO ospr_accomplishment
                 (batch_id, total_pcs_parcel, total_parcel_packed, qty_gal, qty_lit, qty_750, qty_350, qty_1kg_salt)
                 VALUES (:b, :pcs, :parcels, :gal, :lit, :s750, :s350, :kg)
                 ON DUPLICATE KEY UPDATE
                   total_pcs_parcel = VALUES(total_pcs_parcel), total_parcel_packed = VALUES(total_parcel_packed),
                   qty_gal = VALUES(qty_gal), qty_lit = VALUES(qty_lit), qty_750 = VALUES(qty_750),
                   qty_350 = VALUES(qty_350), qty_1kg_salt = VALUES(qty_1kg_salt), computed_at = NOW()'
            )->execute([
                ':b' => $data['batch_id'], ':pcs' => $t['pcs'], ':parcels' => $t['parcels'],
                ':gal' => $byUnit['GAL'], ':lit' => $byUnit['LIT'], ':s750' => $byUnit['750ML'],
                ':s350' => $byUnit['350ML'], ':kg' => $byUnit['KG'],
            ]);

            // Optional boxes-used rows submitted at close time: [{packer_id, box_count}, ...]
            if (!empty($data['boxes_used']) && is_array($data['boxes_used'])) {
                $boxStmt = $pdo->prepare(
                    'INSERT INTO ospr_boxes_used (batch_id, packer_id, box_count) VALUES (:b, :p, :c)
                     ON DUPLICATE KEY UPDATE box_count = VALUES(box_count)'
                );
                foreach ($data['boxes_used'] as $bu) {
                    if (empty($bu['packer_id'])) continue;
                    $boxStmt->execute([':b' => $data['batch_id'], ':p' => $bu['packer_id'], ':c' => $bu['box_count'] ?? 0]);
                }
            }

            $pdo->commit();
            Audit::log('CLOSE_BATCH', 'ospr_batches', (int)$data['batch_id']);
            Http::sendJson(['success' => true, 'accomplishment' => [
                'total_pcs_parcel' => (int)$t['pcs'], 'total_parcel_packed' => (int)$t['parcels'],
                'qty_gal' => $byUnit['GAL'], 'qty_lit' => $byUnit['LIT'], 'qty_750' => $byUnit['750ML'],
                'qty_350' => $byUnit['350ML'], 'qty_1kg_salt' => $byUnit['KG'],
            ]]);
        } catch (Exception $e) {
            $pdo->rollBack();
            Http::sendError('Failed to close batch: ' . $e->getMessage(), 500);
        }
    }
}
