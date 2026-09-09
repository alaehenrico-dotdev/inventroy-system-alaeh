<?php

namespace App\Controllers;

use App\Support\Database;
use App\Support\Http;

class AuditTrailController
{
    public function index(): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') Http::methodNotAllowed();
        $limit = isset($_GET['limit']) ? min(500, (int)$_GET['limit']) : 100;
        $stmt = Database::pdo()->prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ' . $limit);
        $stmt->execute();
        Http::sendJson($stmt->fetchAll());
    }
}
