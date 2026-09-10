// ============================================================
// Shared product-catalog writes - used by ProductsController's
// create/update endpoints and by the CSV import endpoint, so all
// three go through the same rules instead of drifting apart.
//
// Deliberate simplification: adding a unit to a product is
// supported (product_units row + zero-balance channel_inventory
// rows seeded for it), but removing one is not exposed here.
// product_units has no FK relationship to channel_inventory, so
// dropping a unit a product already carries would silently orphan
// whatever ONLINE/OFFLINE balance it has - safer to leave that as a
// manual DB operation than to guess what should happen to existing
// stock.
// ============================================================
import type { PoolConnection } from 'mysql2/promise';

export type ProductFields = {
  name: string;
  sku: string;
  category?: string | null;
  barcode?: string | null;
};

// unit code (e.g. "GAL") -> unit id, for resolving CSV columns.
export async function loadUnitCodeMap(conn: PoolConnection): Promise<Map<string, number>> {
  const [rows] = await conn.execute<any[]>('SELECT id, code FROM units');
  return new Map(rows.map((r) => [String(r.code).toUpperCase(), r.id as number]));
}

export async function findProductBySku(conn: PoolConnection, sku: string): Promise<{ id: number } | undefined> {
  const [rows] = await conn.execute<any[]>('SELECT id FROM products WHERE sku = :sku', { sku });
  return rows[0];
}

export async function insertProduct(conn: PoolConnection, fields: ProductFields): Promise<number> {
  const [result] = await conn.execute<any>(
    'INSERT INTO products (name, sku, category, barcode) VALUES (:name, :sku, :category, :barcode)',
    {
      name: fields.name,
      sku: fields.sku,
      category: fields.category || 'CONDIMENT',
      barcode: fields.barcode || null,
    },
  );
  return result.insertId as number;
}

export async function updateProductFields(conn: PoolConnection, id: number, fields: ProductFields): Promise<void> {
  await conn.execute(
    'UPDATE products SET name = :name, sku = :sku, category = :category, barcode = :barcode WHERE id = :id',
    {
      id,
      name: fields.name,
      sku: fields.sku,
      category: fields.category || 'CONDIMENT',
      barcode: fields.barcode || null,
    },
  );
}

// Links any of `unitIds` not already carried by this product, seeding both
// channels at 0 balance / threshold 10 for each newly-added one - same
// defaults ProductsController's create endpoint has always used.
export async function addProductUnits(conn: PoolConnection, productId: number, unitIds: number[]): Promise<void> {
  if (unitIds.length === 0) return;

  const [existingRows] = await conn.execute<any[]>(
    'SELECT unit_id FROM product_units WHERE product_id = :p',
    { p: productId },
  );
  const existing = new Set(existingRows.map((r) => r.unit_id as number));
  const toAdd = unitIds.filter((u) => !existing.has(u));

  for (const unitId of toAdd) {
    await conn.execute(
      'INSERT INTO product_units (product_id, unit_id) VALUES (:p, :u)',
      { p: productId, u: unitId },
    );
    for (const channel of ['ONLINE', 'OFFLINE'] as const) {
      await conn.execute(
        'INSERT INTO channel_inventory (product_id, unit_id, channel, quantity, low_stock_threshold) VALUES (:p, :u, :c, 0, 10)',
        { p: productId, u: unitId, c: channel },
      );
    }
  }
}
