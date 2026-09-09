<?php

namespace App\Controllers;

use App\Domain\Inventory\ChannelInventory;
use App\Support\Audit;
use App\Support\Database;
use App\Support\Http;
use Exception;

// Digital replacement for the raw hash-mark tally page (Images 1 & 4).
// A withdrawal is Production releasing stock to Packing (the ONLINE channel).
class WithdrawalController
{
    public function index(): void
    {
        $pdo = Database::pdo();

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $sql = "SELECT w.id, w.shift, w.packer_id, pk.packer_no, w.product_id, p.name AS product_name,
                           w.unit_id, u.code AS unit_code, w.quantity, w.withdrawn_at
                    FROM withdrawals w
                    JOIN packers pk ON pk.id = w.packer_id
                    JOIN products p ON p.id = w.product_id
                    JOIN units u ON u.id = w.unit_id
                    WHERE 1=1";
            $params = [];
            if (!empty($_GET['date'])) { $sql .= ' AND DATE(w.withdrawn_at) = :d'; $params[':d'] = $_GET['date']; }
            if (!empty($_GET['shift'])) { $sql .= ' AND w.shift = :s'; $params[':s'] = $_GET['shift']; }
            if (!empty($_GET['packer_id'])) { $sql .= ' AND w.packer_id = :pk'; $params[':pk'] = $_GET['packer_id']; }
            $sql .= ' ORDER BY w.withdrawn_at DESC';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            Http::sendJson($stmt->fetchAll());
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $data = Http::jsonInput();
            Http::requireFields($data, ['shift', 'packer_id', 'product_id', 'unit_id', 'quantity']);

            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare(
                    'INSERT INTO withdrawals (shift, packer_id, product_id, unit_id, quantity)
                     VALUES (:sh, :pk, :p, :u, :q)'
                );
                $stmt->execute([
                    ':sh' => $data['shift'],
                    ':pk' => $data['packer_id'],
                    ':p'  => $data['product_id'],
                    ':u'  => $data['unit_id'],
                    ':q'  => $data['quantity'],
                ]);
                $id = (int)$pdo->lastInsertId();

                ChannelInventory::adjust($pdo, (int)$data['product_id'], (int)$data['unit_id'], 'ONLINE', (float)$data['quantity']);

                $pdo->commit();
                Audit::log('WITHDRAW', 'withdrawals', $id, $data);
                Http::sendJson(['success' => true, 'id' => $id], 201);
            } catch (Exception $e) {
                $pdo->rollBack();
                Http::sendError('Withdrawal failed: ' . $e->getMessage(), 500);
            }
        }

        Http::methodNotAllowed();
    }
}
