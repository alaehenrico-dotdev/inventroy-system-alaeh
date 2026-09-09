<?php

namespace App\Controllers\Ospr;

use App\Support\Audit;
use App\Support\Database;
use App\Support\Http;

class BoxesUsedController
{
    public function index(): void
    {
        $pdo = Database::pdo();

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (empty($_GET['batch_id'])) Http::sendError('batch_id is required', 422);
            $stmt = $pdo->prepare(
                "SELECT bu.*, pk.packer_no FROM ospr_boxes_used bu
                 JOIN packers pk ON pk.id = bu.packer_id WHERE bu.batch_id = :b ORDER BY pk.packer_no"
            );
            $stmt->execute([':b' => $_GET['batch_id']]);
            Http::sendJson($stmt->fetchAll());
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $data = Http::jsonInput();
            Http::requireFields($data, ['batch_id', 'packer_id', 'box_count']);
            $pdo->prepare(
                'INSERT INTO ospr_boxes_used (batch_id, packer_id, box_count) VALUES (:b, :p, :c)
                 ON DUPLICATE KEY UPDATE box_count = VALUES(box_count)'
            )->execute([':b' => $data['batch_id'], ':p' => $data['packer_id'], ':c' => $data['box_count']]);
            Audit::log('LOG_BOXES', 'ospr_boxes_used', null, $data);
            Http::sendJson(['success' => true], 201);
        }

        Http::methodNotAllowed();
    }
}
