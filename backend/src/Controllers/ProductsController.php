<?php

namespace App\Controllers;

use App\Support\Audit;
use App\Support\Database;
use App\Support\Http;
use Exception;

class ProductsController
{
    public function index(): void
    {
        $pdo = Database::pdo();

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $products = $pdo->query('SELECT * FROM products ORDER BY id')->fetchAll();

            $unitStmt = $pdo->prepare(
                'SELECT u.id, u.code, u.label FROM product_units pu
                 JOIN units u ON u.id = pu.unit_id WHERE pu.product_id = :pid ORDER BY u.id'
            );

            foreach ($products as &$p) {
                $unitStmt->execute([':pid' => $p['id']]);
                $p['units'] = $unitStmt->fetchAll();
            }
            Http::sendJson($products);
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $data = Http::jsonInput();
            Http::requireFields($data, ['name', 'unit_ids']);
            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare('INSERT INTO products (name, category, barcode) VALUES (:n, :c, :b)');
                $stmt->execute([
                    ':n' => $data['name'],
                    ':c' => $data['category'] ?? 'CONDIMENT',
                    ':b' => $data['barcode'] ?? null,
                ]);
                $productId = (int)$pdo->lastInsertId();

                $puStmt = $pdo->prepare('INSERT INTO product_units (product_id, unit_id) VALUES (:p, :u)');
                $ciStmt = $pdo->prepare(
                    'INSERT INTO channel_inventory (product_id, unit_id, channel, quantity, low_stock_threshold)
                     VALUES (:p, :u, :c, 0, 10)'
                );
                foreach ($data['unit_ids'] as $unitId) {
                    $puStmt->execute([':p' => $productId, ':u' => $unitId]);
                    $ciStmt->execute([':p' => $productId, ':u' => $unitId, ':c' => 'ONLINE']);
                    $ciStmt->execute([':p' => $productId, ':u' => $unitId, ':c' => 'OFFLINE']);
                }
                $pdo->commit();
                Audit::log('CREATE', 'products', $productId, $data);
                Http::sendJson(['success' => true, 'id' => $productId], 201);
            } catch (Exception $e) {
                $pdo->rollBack();
                Http::sendError('Failed to create product: ' . $e->getMessage(), 500);
            }
        }

        Http::methodNotAllowed();
    }
}
