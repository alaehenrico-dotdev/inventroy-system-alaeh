// ============================================================
// Single choke point for mutating channel_inventory balances -
// mirrors Domain/Inventory/ChannelInventory.php. Used inside an
// already-open transaction by nearly every write endpoint.
//
// Quirk preserved from the PHP version: if no row exists yet for
// (product_id, unit_id, channel), one is INSERTed seeded at
// max(0, delta) with a hardcoded low_stock_threshold of 10 - i.e. a
// negative delta against a never-seeded row floors at 0 instead of
// going negative or erroring. In practice this rarely triggers
// because ProductsController seeds both channel rows on product
// creation, but it's a real edge case, preserved intentionally
// rather than silently "fixed" during the port.
// ============================================================
import type { PoolConnection } from 'mysql2/promise';

export type Channel = 'ONLINE' | 'OFFLINE';

export async function adjust(
  conn: PoolConnection,
  productId: number,
  unitId: number,
  channel: Channel,
  delta: number,
): Promise<void> {
  const [rows] = await conn.execute<any[]>(
    'SELECT id, quantity FROM channel_inventory WHERE product_id = :p AND unit_id = :u AND channel = :c',
    { p: productId, u: unitId, c: channel },
  );

  if (rows.length > 0) {
    await conn.execute(
      'UPDATE channel_inventory SET quantity = quantity + :delta WHERE id = :id',
      { delta, id: rows[0].id },
    );
    return;
  }

  await conn.execute(
    'INSERT INTO channel_inventory (product_id, unit_id, channel, quantity, low_stock_threshold) VALUES (:p, :u, :c, :q, 10)',
    { p: productId, u: unitId, c: channel, q: Math.max(0, delta) },
  );
}
