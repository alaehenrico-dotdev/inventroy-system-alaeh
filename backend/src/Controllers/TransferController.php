<?php

namespace App\Controllers;

use App\Domain\Inventory\ChannelInventory;
use App\Support\Audit;
use App\Support\Database;
use App\Support\Http;
use Exception;

// Inter-channel transfer: scan-before-move, atomic decrement/increment,
// immutable ledger row (Section 4).
class TransferController
{
    public function index(): void
    {
        $pdo = Database::pdo();

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $sql = "SELECT t.*, p.name AS product_name, u.code AS unit_code
                    FROM inter_channel_transfers t
                    JOIN products p ON p.id = t.product_id
                    JOIN units u ON u.id = t.unit_id
                    ORDER BY t.created_at DESC";
            Http::sendJson($pdo->query($sql)->fetchAll());
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $data = Http::jsonInput();
            Http::requireFields($data, ['product_id', 'unit_id', 'source_channel', 'destination_channel', 'quantity', 'reason_code']);

            if ($data['source_channel'] === $data['destination_channel']) {
                Http::sendError('Source and destination channel must differ', 422);
            }

            // Configurable approval threshold for large transfers.
            $approvalThreshold = 200;
            $status = ((float)$data['quantity'] >= $approvalThreshold) ? 'PENDING_APPROVAL' : 'CLEARED';

            $pdo->beginTransaction();
            try {
                // Validate source balance.
                $stmt = $pdo->prepare(
                    'SELECT quantity FROM channel_inventory WHERE product_id = :p AND unit_id = :u AND channel = :c'
                );
                $stmt->execute([':p' => $data['product_id'], ':u' => $data['unit_id'], ':c' => $data['source_channel']]);
                $row = $stmt->fetch();
                $available = $row ? (float)$row['quantity'] : 0;
                if ($available < (float)$data['quantity']) {
                    $pdo->rollBack();
                    Http::sendError("Insufficient stock in {$data['source_channel']}: available {$available}", 422);
                }

                $ins = $pdo->prepare(
                    'INSERT INTO inter_channel_transfers
                     (product_id, unit_id, source_channel, destination_channel, quantity, reason_code, status)
                     VALUES (:p, :u, :sc, :dc, :q, :r, :st)'
                );
                $ins->execute([
                    ':p' => $data['product_id'], ':u' => $data['unit_id'],
                    ':sc' => $data['source_channel'], ':dc' => $data['destination_channel'],
                    ':q' => $data['quantity'], ':r' => $data['reason_code'], ':st' => $status,
                ]);
                $id = (int)$pdo->lastInsertId();

                if ($status === 'CLEARED') {
                    ChannelInventory::adjust($pdo, (int)$data['product_id'], (int)$data['unit_id'], $data['source_channel'], -(float)$data['quantity']);
                    ChannelInventory::adjust($pdo, (int)$data['product_id'], (int)$data['unit_id'], $data['destination_channel'], (float)$data['quantity']);
                }

                $pdo->commit();
                Audit::log('TRANSFER_' . $status, 'inter_channel_transfers', $id, $data);
                Http::sendJson(['success' => true, 'id' => $id, 'status' => $status], 201);
            } catch (Exception $e) {
                $pdo->rollBack();
                Http::sendError('Transfer failed: ' . $e->getMessage(), 500);
            }
        }

        if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            // Admin approval of a PENDING_APPROVAL transfer -> clears it for physical movement.
            $data = Http::jsonInput();
            Http::requireFields($data, ['id']);
            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare('SELECT * FROM inter_channel_transfers WHERE id = :id FOR UPDATE');
                $stmt->execute([':id' => $data['id']]);
                $t = $stmt->fetch();
                if (!$t) { $pdo->rollBack(); Http::sendError('Transfer not found', 404); }
                if ($t['status'] === 'CLEARED') { $pdo->rollBack(); Http::sendError('Transfer already cleared', 409); }

                ChannelInventory::adjust($pdo, (int)$t['product_id'], (int)$t['unit_id'], $t['source_channel'], -(float)$t['quantity']);
                ChannelInventory::adjust($pdo, (int)$t['product_id'], (int)$t['unit_id'], $t['destination_channel'], (float)$t['quantity']);
                $pdo->prepare("UPDATE inter_channel_transfers SET status = 'CLEARED' WHERE id = :id")->execute([':id' => $t['id']]);

                $pdo->commit();
                Audit::log('TRANSFER_APPROVED', 'inter_channel_transfers', (int)$t['id']);
                Http::sendJson(['success' => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                Http::sendError('Approval failed: ' . $e->getMessage(), 500);
            }
        }

        Http::methodNotAllowed();
    }
}
