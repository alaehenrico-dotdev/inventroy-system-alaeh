<?php
// ============================================================
// Manual PSR-4-style autoloader for the App\ namespace - no
// Composer required, keeps the "just copy the folder" XAMPP setup.
// ============================================================

spl_autoload_register(function (string $class): void {
    $prefix = 'App\\';
    if (strncmp($prefix, $class, strlen($prefix)) !== 0) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $path = __DIR__ . '/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($path)) {
        require $path;
    }
});

require_once __DIR__ . '/config.php';
