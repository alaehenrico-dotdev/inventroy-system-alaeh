<?php

namespace App\Controllers\Ospr;

use App\Domain\Inventory\ChannelInventory;
use App\Support\Audit;
use App\Support\Database;
use App\Support\Http;
use Exception;

// Scans one order line onto the open batch - replaces hand-writing each row.
// Packing an item ships it out of the ONLINE channel.
class ItemController
{
    public function index(): void
    {
        $pdo = Database::pdo();

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (empty($_GET['batch_id'])) Http::sendError('batch_id is required', 422);
            $stmt = $pdo->prepare(
                "SELECT oi.*, p.name AS product_name, u.code AS unit_code
                 FROM ospr_order_items oi
                 JOIN products p ON p.id = oi.product_id
                 JOIN units u ON u.id = oi.unit_id
                 WHERE oi.batch_id = :b ORDER BY oi.seq_no"
            );
            $stmt->execute([':b' => $_GET['batch_id']]);
            Http::sendJson($stmt->fetchAll());
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $data = Http::jsonInput();
            Http::requireFields($data, ['batch_id', 'code_name', 'product_id', 'unit_id']);

            $pdo->beginTransaction();
            try {
                $batch = $pdo->prepare('SELECT status FROM ospr_batches WHERE id = :id FOR UPDATE');
                $batch->execute([':id' => $data['batch_id']]);
                $b = $batch->fetch();
                if (!$b) { $pdo->rollBack(); Http::sendError('Batch not found', 404); }
                if ($b['status'] !== 'OPEN') { $pdo->rollBack(); Http::sendError('Batch is already closed', 409); }

                $seqStmt = $pdo->prepare('SELECT COALESCE(MAX(seq_no),0)+1 AS next_seq FROM ospr_order_items WHERE batch_id = :b');
                $seqStmt->execute([':b' => $data['batch_id']]);
                $seq = $seqStmt->fetch()['next_seq'];

                $qty = isset($data['quantity']) ? (float)$data['quantity'] : 1;

                $ins = $pdo->prepare(
                    'INSERT INTO ospr_order_items (batch_id, seq_no, code_name, product_id, unit_id, quantity, customer_name)
                     VALUES (:b, :s, :cn, :p, :u, :q, :cu)'
                );
                $ins->execute([
                    ':b' => $data['batch_id'], ':s' => $seq, ':cn' => $data['code_name'],
                    ':p' => $data['product_id'], ':u' => $data['unit_id'], ':q' => $qty,
                    ':cu' => $data['customer_name'] ?? null,
                ]);
                $id = (int)$pdo->lastInsertId();

                ChannelInventory::adjust($pdo, (int)$data['product_id'], (int)$data['unit_id'], 'ONLINE', -$qty);

                $pdo->commit();
                Audit::log('ADD_ORDER_ITEM', 'ospr_order_items', $id, $data);
                Http::sendJson(['success' => true, 'id' => $id, 'seq_no' => $seq], 201);
            } catch (Exception $e) {
                $pdo->rollBack();
                Http::sendError('Failed to add order item: ' . $e->getMessage(), 500);
            }
        }

        if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            $data = Http::jsonInput();
            Http::requireFields($data, ['id']);
            $pdo->prepare('DELETE FROM ospr_order_items WHERE id = :id')->execute([':id' => $data['id']]);
            Audit::log('DELETE_ORDER_ITEM', 'ospr_order_items', (int)$data['id']);
            Http::sendJson(['success' => true]);
        }

        Http::methodNotAllowed();
    }
}
