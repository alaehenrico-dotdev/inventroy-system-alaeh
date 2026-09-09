<?php

namespace App\Controllers;

use App\Support\Database;
use App\Support\Http;

// Section 8.4 - Dual Log Book: By SKU and By Packer.
class LogBooksController
{
    public function index(): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') Http::methodNotAllowed();
        $pdo = Database::pdo();

        $view = $_GET['view'] ?? 'sku';

        if ($view === 'sku') {
            $sql = "SELECT p.id AS product_id, p.name AS product_name, u.code AS unit_code,
                           COALESCE(SUM(w.quantity),0) AS total_withdrawn,
                           COALESCE((SELECT SUM(oi.quantity) FROM ospr_order_items oi WHERE oi.product_id = p.id AND oi.unit_id = u.id),0) AS total_packed
                    FROM product_units pu
                    JOIN products p ON p.id = pu.product_id
                    JOIN units u ON u.id = pu.unit_id
                    LEFT JOIN withdrawals w ON w.product_id = p.id AND w.unit_id = u.id
                    GROUP BY p.id, u.id
                    ORDER BY p.name, u.id";
            Http::sendJson($pdo->query($sql)->fetchAll());
        }

        if ($view === 'packer') {
            $sql = "SELECT pk.id AS packer_id, pk.packer_no,
                           COALESCE((SELECT SUM(w.quantity) FROM withdrawals w WHERE w.packer_id = pk.id),0) AS total_withdrawn,
                           COALESCE((SELECT SUM(bu.box_count) FROM ospr_boxes_used bu WHERE bu.packer_id = pk.id),0) AS total_boxes_packed,
                           (SELECT COUNT(*) FROM ospr_batches b WHERE b.packed_by = pk.id) AS batches_packed
                    FROM packers pk ORDER BY pk.packer_no";
            Http::sendJson($pdo->query($sql)->fetchAll());
        }

        Http::sendError('Invalid view - use ?view=sku or ?view=packer', 422);
    }
}
