<?php

namespace App\Support;

class Http
{
    // ------------------------------------------------------------
    // CORS - allow the React dev server / any local origin to call
    // this API. Tighten allowed origins before production use.
    // ------------------------------------------------------------
    public static function applyCors(): void
    {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Content-Type: application/json; charset=utf-8');
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }

    public static function jsonInput(): array
    {
        $raw = file_get_contents('php://input');
        if (!$raw) return [];
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    public static function sendJson($data, int $status = 200): void
    {
        http_response_code($status);
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function sendError(string $message, int $status = 400): void
    {
        self::sendJson(['error' => $message], $status);
    }

    public static function requireFields(array $data, array $fields): void
    {
        foreach ($fields as $f) {
            if (!array_key_exists($f, $data) || $data[$f] === '' || $data[$f] === null) {
                self::sendError("Missing required field: {$f}", 422);
            }
        }
    }

    public static function methodNotAllowed(): void
    {
        self::sendError('Method not allowed', 405);
    }
}
