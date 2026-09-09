<?php

namespace App\Controllers;

use App\Domain\Inventory\ChannelInventory;
use App\Support\Audit;
use App\Support\Database;
use App\Support\Http;
use Exception;

// Offline logistics: Delivery Receipt / Backload / Upsell / Bad Order.
// Each updates the OFFLINE channel balance directly.
class LogisticsController
{
    private const INCREASING = ['DELIVERY_RECEIPT', 'BACKLOAD'];
    private const DECREASING = ['UPSELL', 'BAD_ORDER'];

    public function index(): void
    {
        $pdo = Database::pdo();

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $sql = "SELECT lt.*, p.name AS product_name, u.code AS unit_code
                    FROM logistics_transactions lt
                    JOIN products p ON p.id = lt.product_id
                    JOIN units u ON u.id = lt.unit_id WHERE 1=1";
            $params = [];
            if (!empty($_GET['type'])) { $sql .= ' AND lt.type = :t'; $params[':t'] = $_GET['type']; }
            $sql .= ' ORDER BY lt.logged_at DESC';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            Http::sendJson($stmt->fetchAll());
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $data = Http::jsonInput();
            Http::requireFields($data, ['type', 'product_id', 'unit_id', 'quantity']);
            if (!in_array($data['type'], array_merge(self::INCREASING, self::DECREASING), true)) {
                Http::sendError('Invalid transaction type', 422);
            }

            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare(
                    'INSERT INTO logistics_transactions (type, product_id, unit_id, quantity, reference)
                     VALUES (:t, :p, :u, :q, :r)'
                );
                $stmt->execute([
                    ':t' => $data['type'], ':p' => $data['product_id'], ':u' => $data['unit_id'],
                    ':q' => $data['quantity'], ':r' => $data['reference'] ?? null,
                ]);
                $id = (int)$pdo->lastInsertId();

                $delta = in_array($data['type'], self::INCREASING, true) ? (float)$data['quantity'] : -(float)$data['quantity'];
                ChannelInventory::adjust($pdo, (int)$data['product_id'], (int)$data['unit_id'], 'OFFLINE', $delta);

                $pdo->commit();
                Audit::log('LOGISTICS_' . $data['type'], 'logistics_transactions', $id, $data);
                Http::sendJson(['success' => true, 'id' => $id], 201);
            } catch (Exception $e) {
                $pdo->rollBack();
                Http::sendError('Failed to log transaction: ' . $e->getMessage(), 500);
            }
        }

        Http::methodNotAllowed();
    }
}
