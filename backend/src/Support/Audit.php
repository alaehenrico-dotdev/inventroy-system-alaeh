<?php

namespace App\Support;

class Audit
{
    public static function log(string $action, string $entity, $entityId = null, $details = null): void
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'INSERT INTO audit_log (action, entity, entity_id, details) VALUES (:a, :e, :id, :d)'
        );
        $stmt->execute([
            ':a'  => $action,
            ':e'  => $entity,
            ':id' => $entityId,
            ':d'  => is_array($details) || is_object($details) ? json_encode($details) : $details,
        ]);
    }
}
