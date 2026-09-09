<?php

namespace App\Controllers;

use App\Support\Audit;
use App\Support\Database;
use App\Support\Http;

class PackersController
{
    public function index(): void
    {
        $pdo = Database::pdo();

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $rows = $pdo->query('SELECT * FROM packers ORDER BY packer_no')->fetchAll();
            Http::sendJson($rows);
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $data = Http::jsonInput();
            Http::requireFields($data, ['packer_no']);
            $stmt = $pdo->prepare('INSERT INTO packers (packer_no, name, active) VALUES (:no, :name, 1)
                                    ON DUPLICATE KEY UPDATE name = VALUES(name)');
            $stmt->execute([':no' => $data['packer_no'], ':name' => $data['name'] ?? null]);
            Audit::log('CREATE', 'packers', (int)$pdo->lastInsertId());
            Http::sendJson(['success' => true], 201);
        }

        Http::methodNotAllowed();
    }
}
