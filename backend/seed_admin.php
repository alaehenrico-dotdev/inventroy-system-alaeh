<?php
// One-time setup script: creates/resets the default admin login.
// Open this file once in your browser (http://localhost/inventory-api/seed_admin.php)
// after importing schema.sql, then DELETE this file for security.

require_once __DIR__ . '/src/bootstrap.php';

use App\Support\Database;

$username = 'admin';
$password = 'admin123'; // change this after first login
$hash = password_hash($password, PASSWORD_BCRYPT);

$pdo = Database::pdo();
$stmt = $pdo->prepare(
    'INSERT INTO users (name, username, password_hash, role) VALUES ("Administrator", :u, :h, "ADMIN")
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)'
);
$stmt->execute([':u' => $username, ':h' => $hash]);

header('Content-Type: text/plain');
echo "Admin user ready.\nUsername: {$username}\nPassword: {$password}\n\nDelete this file (seed_admin.php) now that setup is complete.\n";
