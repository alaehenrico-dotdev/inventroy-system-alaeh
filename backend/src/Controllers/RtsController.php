<?php

namespace App\Controllers;

use App\Domain\Inventory\ChannelInventory;
use App\Support\Audit;
use App\Support\Database;
use App\Support\Http;
use Exception;

// A return: single tally per product by default (category = UNSORTED),
// with GOOD/LEAK/BAD_ORDER available once the team opts in (Section 5.3).
// A return puts stock back into the ONLINE channel.
class RtsController
{
    public function index(): void
    {
        $pdo = Database::pdo();

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $sql = "SELECT r.*, p.name AS product_name, u.code AS unit_code
                    FROM rts_triage r
                    JOIN products p ON p.id = r.product_id
                    JOIN units u ON u.id = r.unit_id WHERE 1=1";
            $params = [];
            if (!empty($_GET['date'])) { $sql .= ' AND DATE(r.logged_at) = :d'; $params[':d'] = $_GET['date']; }
            $sql .= ' ORDER BY r.logged_at DESC';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            Http::sendJson($stmt->fetchAll());
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $data = Http::jsonInput();
            Http::requireFields($data, ['product_id', 'unit_id', 'quantity']);

            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare(
                    'INSERT INTO rts_triage (product_id, unit_id, quantity, category, notes)
                     VALUES (:p, :u, :q, :c, :n)'
                );
                $stmt->execute([
                    ':p' => $data['product_id'], ':u' => $data['unit_id'], ':q' => $data['quantity'],
                    ':c' => $data['category'] ?? 'UNSORTED', ':n' => $data['notes'] ?? null,
                ]);
                $id = (int)$pdo->lastInsertId();

                ChannelInventory::adjust($pdo, (int)$data['product_id'], (int)$data['unit_id'], 'ONLINE', (float)$data['quantity']);

                $pdo->commit();
                Audit::log('LOG_RTS', 'rts_triage', $id, $data);
                Http::sendJson(['success' => true, 'id' => $id], 201);
            } catch (Exception $e) {
                $pdo->rollBack();
                Http::sendError('Failed to log RTS: ' . $e->getMessage(), 500);
            }
        }

        Http::methodNotAllowed();
    }
}
