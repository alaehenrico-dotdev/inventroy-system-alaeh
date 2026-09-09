<?php

namespace App\Controllers;

use App\Support\Audit;
use App\Support\Database;
use App\Support\Http;

class InventoryController
{
    public function index(): void
    {
        $pdo = Database::pdo();

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $channel = $_GET['channel'] ?? null;
            $sql = "SELECT ci.id, ci.product_id, p.name AS product_name, p.category,
                           ci.unit_id, u.code AS unit_code, u.label AS unit_label,
                           ci.channel, ci.quantity, ci.low_stock_threshold, ci.updated_at
                    FROM channel_inventory ci
                    JOIN products p ON p.id = ci.product_id
                    JOIN units u ON u.id = ci.unit_id";
            $params = [];
            if ($channel) {
                $sql .= ' WHERE ci.channel = :c';
                $params[':c'] = $channel;
            }
            $sql .= ' ORDER BY p.name, u.id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            Http::sendJson($stmt->fetchAll());
        }

        if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            // Manual correction of a balance / threshold (Admin only in a full build)
            $data = Http::jsonInput();
            Http::requireFields($data, ['id']);
            $sets = [];
            $params = [':id' => $data['id']];
            if (isset($data['quantity'])) { $sets[] = 'quantity = :q'; $params[':q'] = $data['quantity']; }
            if (isset($data['low_stock_threshold'])) { $sets[] = 'low_stock_threshold = :t'; $params[':t'] = $data['low_stock_threshold']; }
            if (!$sets) Http::sendError('Nothing to update', 422);
            $sql = 'UPDATE channel_inventory SET ' . implode(', ', $sets) . ' WHERE id = :id';
            $pdo->prepare($sql)->execute($params);
            Audit::log('UPDATE', 'channel_inventory', (int)$data['id'], $data);
            Http::sendJson(['success' => true]);
        }

        Http::methodNotAllowed();
    }

    public function lowStock(): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') Http::methodNotAllowed();
        $sql = "SELECT ci.id, p.name AS product_name, u.code AS unit_code, ci.channel,
                       ci.quantity, ci.low_stock_threshold
                FROM channel_inventory ci
                JOIN products p ON p.id = ci.product_id
                JOIN units u ON u.id = ci.unit_id
                WHERE ci.quantity <= ci.low_stock_threshold
                ORDER BY (ci.low_stock_threshold - ci.quantity) DESC";
        Http::sendJson(Database::pdo()->query($sql)->fetchAll());
    }
}
