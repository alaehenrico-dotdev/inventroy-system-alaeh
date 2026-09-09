<?php

namespace App\Controllers;

use App\Support\Audit;
use App\Support\Database;
use App\Support\Http;

class AuthController
{
    public function login(): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') Http::methodNotAllowed();
        $pdo = Database::pdo();

        $data = Http::jsonInput();
        Http::requireFields($data, ['username', 'password']);

        $stmt = $pdo->prepare('SELECT * FROM users WHERE username = :u AND active = 1');
        $stmt->execute([':u' => $data['username']]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($data['password'], $user['password_hash'])) {
            Http::sendError('Invalid username or password', 401);
        }

        Audit::log('LOGIN', 'users', (int)$user['id']);
        Http::sendJson([
            'success' => true,
            'user' => [
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'username' => $user['username'],
                'role' => $user['role'],
                'packer_no' => $user['packer_no'],
            ],
        ]);
    }
}
