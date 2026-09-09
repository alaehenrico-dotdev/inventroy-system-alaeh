<?php

namespace App\Controllers;

use App\Support\Database;
use App\Support\Http;

class UnitsController
{
    public function index(): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') Http::methodNotAllowed();
        $rows = Database::pdo()->query('SELECT * FROM units ORDER BY id')->fetchAll();
        Http::sendJson($rows);
    }
}
