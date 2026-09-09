<?php

namespace App\Domain\Inventory;

use PDO;

class ChannelInventory
{
    // Adjust a channel_inventory balance by a signed delta (+ increases, - decreases).
    // Creates the row (starting at 0) if it does not already exist.
    public static function adjust(PDO $pdo, int $productId, int $unitId, string $channel, float $delta): void
    {
        $stmt = $pdo->prepare(
            'SELECT id, quantity FROM channel_inventory WHERE product_id = :p AND unit_id = :u AND channel = :c'
        );
        $stmt->execute([':p' => $productId, ':u' => $unitId, ':c' => $channel]);
        $row = $stmt->fetch();

        if ($row) {
            $pdo->prepare('UPDATE channel_inventory SET quantity = quantity + :d WHERE id = :id')
                ->execute([':d' => $delta, ':id' => $row['id']]);
        } else {
            $pdo->prepare(
                'INSERT INTO channel_inventory (product_id, unit_id, channel, quantity, low_stock_threshold)
                 VALUES (:p, :u, :c, :d, 10)'
            )->execute([':p' => $productId, ':u' => $unitId, ':c' => $channel, ':d' => max(0, $delta)]);
        }
    }
}
