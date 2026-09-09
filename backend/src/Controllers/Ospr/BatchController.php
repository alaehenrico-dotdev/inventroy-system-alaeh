<?php

namespace App\Controllers\Ospr;

use App\Support\Audit;
use App\Support\Database;
use App\Support\Http;

class BatchController
{
    public function index(): void
    {
        $pdo = Database::pdo();

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (!empty($_GET['id'])) {
                $stmt = $pdo->prepare(
                    "SELECT b.*, pk.packer_no AS packed_by_no
                     FROM ospr_batches b LEFT JOIN packers pk ON pk.id = b.packed_by
                     WHERE b.id = :id"
                );
                $stmt->execute([':id' => $_GET['id']]);
                $batch = $stmt->fetch();
                if (!$batch) Http::sendError('Batch not found', 404);

                $items = $pdo->prepare(
                    "SELECT oi.*, p.name AS product_name, u.code AS unit_code
                     FROM ospr_order_items oi
                     JOIN products p ON p.id = oi.product_id
                     JOIN units u ON u.id = oi.unit_id
                     WHERE oi.batch_id = :id ORDER BY oi.seq_no"
                );
                $items->execute([':id' => $_GET['id']]);
                $batch['items'] = $items->fetchAll();

                $acc = $pdo->prepare('SELECT * FROM ospr_accomplishment WHERE batch_id = :id');
                $acc->execute([':id' => $_GET['id']]);
                $batch['accomplishment'] = $acc->fetch() ?: null;

                $boxes = $pdo->prepare(
                    "SELECT bu.*, pk.packer_no FROM ospr_boxes_used bu
                     JOIN packers pk ON pk.id = bu.packer_id WHERE bu.batch_id = :id ORDER BY pk.packer_no"
                );
                $boxes->execute([':id' => $_GET['id']]);
                $batch['boxes_used'] = $boxes->fetchAll();

                Http::sendJson($batch);
            }

            $sql = "SELECT b.*, pk.packer_no AS packed_by_no,
                           (SELECT COUNT(*) FROM ospr_order_items oi WHERE oi.batch_id = b.id) AS item_count
                    FROM ospr_batches b LEFT JOIN packers pk ON pk.id = b.packed_by
                    ORDER BY b.created_at DESC";
            Http::sendJson($pdo->query($sql)->fetchAll());
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $data = Http::jsonInput();
            Http::requireFields($data, ['batch_date']);
            $stmt = $pdo->prepare(
                'INSERT INTO ospr_batches (batch_date, prepared_by, courier, time_started, status)
                 VALUES (:d, :pb, :c, :ts, "OPEN")'
            );
            $stmt->execute([
                ':d'  => $data['batch_date'],
                ':pb' => $data['prepared_by'] ?? null,
                ':c'  => $data['courier'] ?? null,
                ':ts' => $data['time_started'] ?? date('H:i:s'),
            ]);
            $id = (int)$pdo->lastInsertId();
            Audit::log('OPEN_BATCH', 'ospr_batches', $id, $data);
            Http::sendJson(['success' => true, 'id' => $id], 201);
        }

        Http::methodNotAllowed();
    }
}
