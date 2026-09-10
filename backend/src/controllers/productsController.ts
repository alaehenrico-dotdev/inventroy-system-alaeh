// Mirrors Controllers/ProductsController.php -
// GET/POST /api/products, GET /api/products/lookup
import type { Request, Response } from 'express';
import { pool, query } from '../db/pool.js';
import { auditLog } from '../support/audit.js';
import { requireFields, sendError, sendJson } from '../support/http.js';

type ProductRow = Record<string, any>;

// The PHP version attaches units per-product with an N+1 query; this does
// the same thing with one query for the whole batch instead - output shape
// (units: [{id, code, label}] per product) is unchanged.
async function attachUnits(products: ProductRow[]): Promise<ProductRow[]> {
  if (products.length === 0) return products;

  const params: Record<string, any> = {};
  const placeholders = products.map((p, i) => {
    params[`id${i}`] = p.id;
    return `:id${i}`;
  });

  const rows = await query<ProductRow>(
    `SELECT pu.product_id AS product_id, u.id AS id, u.code AS code, u.label AS label
     FROM product_units pu JOIN units u ON u.id = pu.unit_id
     WHERE pu.product_id IN (${placeholders.join(',')})
     ORDER BY u.id`,
    params,
  );

  const byProduct = new Map<number, ProductRow[]>();
  for (const r of rows) {
    const list = byProduct.get(r.product_id) ?? [];
    list.push({ id: r.id, code: r.code, label: r.label });
    byProduct.set(r.product_id, list);
  }

  return products.map((p) => ({ ...p, units: byProduct.get(p.id) ?? [] }));
}

export async function index(req: Request, res: Response): Promise<void> {
  if (req.method === 'POST') {
    return create(req, res);
  }
  const products = await query<ProductRow>('SELECT * FROM products ORDER BY id');
  sendJson(res, await attachUnits(products));
}

async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['name', 'unit_ids'])) return;

  const unitIds = body.unit_ids;
  if (!Array.isArray(unitIds)) {
    sendError(res, 'unit_ids must be an array', 422);
    return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [productResult] = await conn.execute<any>(
      'INSERT INTO products (name, category, barcode) VALUES (:name, :category, :barcode)',
      { name: body.name, category: body.category ?? 'CONDIMENT', barcode: body.barcode ?? null },
    );
    const productId = productResult.insertId as number;

    for (const unitId of unitIds) {
      await conn.execute(
        'INSERT INTO product_units (product_id, unit_id) VALUES (:p, :u)',
        { p: productId, u: unitId },
      );
      // Seed both channels at 0 balance / threshold 10 - same hardcoded
      // defaults as the PHP version. Not configurable via this endpoint.
      for (const channel of ['ONLINE', 'OFFLINE'] as const) {
        await conn.execute(
          'INSERT INTO channel_inventory (product_id, unit_id, channel, quantity, low_stock_threshold) VALUES (:p, :u, :c, 0, 10)',
          { p: productId, u: unitId, c: channel },
        );
      }
    }

    await conn.commit();
    await auditLog('CREATE', 'products', productId, body);
    sendJson(res, { success: true, id: productId }, 201);
  } catch (err) {
    await conn.rollback();
    sendError(res, `Failed to create product: ${err instanceof Error ? err.message : String(err)}`, 500);
  } finally {
    conn.release();
  }
}

export async function lookup(req: Request, res: Response): Promise<void> {
  const barcode = req.query.barcode as string | undefined;
  if (!barcode) {
    sendError(res, 'Missing required field: barcode', 422);
    return;
  }

  const rows = await query<ProductRow>(
    'SELECT * FROM products WHERE barcode = :barcode AND active = 1',
    { barcode },
  );
  if (rows.length === 0) {
    sendError(res, 'No product matches that barcode', 404);
    return;
  }

  const [withUnits] = await attachUnits(rows);
  sendJson(res, withUnits);
}
