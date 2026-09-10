// Mirrors Controllers/ProductsController.php -
// GET/POST/PUT /api/products, GET /api/products/lookup,
// GET /api/products/export, POST /api/products/import
import type { Request, Response } from 'express';
import { pool, query } from '../db/pool.js';
import { auditLog } from '../support/audit.js';
import { parseCsv, toCsv } from '../support/csv.js';
import {
  addProductUnits,
  findProductBySku,
  insertProduct,
  loadUnitCodeMap,
  updateProductFields,
} from '../domain/productCatalog.js';
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
  if (req.method === 'POST') return create(req, res);
  if (req.method === 'PUT') return update(req, res);
  const products = await query<ProductRow>('SELECT * FROM products ORDER BY id');
  sendJson(res, await attachUnits(products));
}

async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['name', 'sku', 'unit_ids'])) return;

  const unitIds = body.unit_ids;
  if (!Array.isArray(unitIds) || unitIds.length === 0) {
    sendError(res, 'unit_ids must be a non-empty array', 422);
    return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (await findProductBySku(conn, body.sku)) {
      await conn.rollback();
      sendError(res, `SKU "${body.sku}" is already in use`, 409);
      return;
    }

    const productId = await insertProduct(conn, body as any);
    await addProductUnits(conn, productId, unitIds.map(Number));

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

// Edits an existing product's name/sku/category/barcode, and (optionally)
// adds new units to it - see domain/productCatalog.ts for why removing a
// unit isn't supported here. SKU is editable (uniqueness re-checked against
// every other product) precisely so the placeholder AE-#### SKUs seeded by
// the schema/migration can be re-coded to real ones without touching the
// database directly.
async function update(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['id', 'name', 'sku'])) return;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute<any[]>('SELECT id FROM products WHERE id = :id FOR UPDATE', { id: body.id });
    if (!rows[0]) {
      await conn.rollback();
      sendError(res, 'Product not found', 404);
      return;
    }

    const skuOwner = await findProductBySku(conn, body.sku);
    if (skuOwner && skuOwner.id !== Number(body.id)) {
      await conn.rollback();
      sendError(res, `SKU "${body.sku}" is already in use`, 409);
      return;
    }

    await updateProductFields(conn, Number(body.id), body as any);

    const addUnitIds = Array.isArray(body.add_unit_ids) ? body.add_unit_ids.map(Number) : [];
    await addProductUnits(conn, Number(body.id), addUnitIds);

    await conn.commit();
    await auditLog('UPDATE', 'products', Number(body.id), body);
    sendJson(res, { success: true });
  } catch (err) {
    await conn.rollback();
    sendError(res, `Failed to update product: ${err instanceof Error ? err.message : String(err)}`, 500);
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

const EXPORT_COLUMNS = ['id', 'name', 'sku', 'category', 'barcode', 'active', 'units'];

export async function exportCsv(_req: Request, res: Response): Promise<void> {
  const products = await query<ProductRow>('SELECT * FROM products ORDER BY id');
  const withUnits = await attachUnits(products);

  const rows = withUnits.map((p) => ({
    ...p,
    barcode: p.barcode ?? '',
    units: p.units.map((u: ProductRow) => u.code).join(';'),
  }));

  const csv = toCsv(rows, EXPORT_COLUMNS);
  const filename = `product-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
}

type ImportRowError = { row: number; message: string };

// Body: { csv: "<raw file text>" }. Upserts by SKU (required per row):
// a matching SKU updates name/category/barcode and adds any new units
// listed; an unmatched SKU inserts a new product. Column `units` is one
// or more unit codes (e.g. "GAL;LIT" - ";", "," or "|" all accepted,
// quote the cell if you use a comma). Unrecognized unit codes are dropped
// with a warning rather than failing the whole row, but a row needs at
// least one that resolves (a product must carry >=1 unit, same rule the
// manual "Add a product" form enforces).
export async function importCsv(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['csv'])) return;

  let records: Record<string, string>[];
  try {
    records = parseCsv(String(body.csv));
  } catch (err) {
    sendError(res, `Could not parse CSV: ${err instanceof Error ? err.message : String(err)}`, 422);
    return;
  }

  if (records.length === 0) {
    sendError(res, 'CSV has no data rows', 422);
    return;
  }

  const conn = await pool.getConnection();
  let created = 0;
  let updated = 0;
  const errors: ImportRowError[] = [];

  try {
    await conn.beginTransaction();
    const unitCodeMap = await loadUnitCodeMap(conn);

    for (let i = 0; i < records.length; i++) {
      const rowNo = i + 2; // header is row 1, so first data row is row 2
      const record = records[i];
      const sku = (record.sku || '').trim();
      const name = (record.name || '').trim();

      if (!sku || !name) {
        errors.push({ row: rowNo, message: 'Missing required "name" or "sku" value - row skipped.' });
        continue;
      }

      const codes = (record.units || '')
        .split(/[,;|]/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
      const unitIds: number[] = [];
      const unknownCodes: string[] = [];
      for (const code of codes) {
        const id = unitCodeMap.get(code);
        if (id) unitIds.push(id);
        else unknownCodes.push(code);
      }

      const existing = await findProductBySku(conn, sku);

      if (!existing && unitIds.length === 0) {
        errors.push({
          row: rowNo,
          message: `No recognized unit codes (${codes.join(', ') || 'none given'}) - a new product needs at least one. Row skipped.`,
        });
        continue;
      }

      const fields = {
        name,
        sku,
        category: record.category || 'CONDIMENT',
        barcode: record.barcode || null,
      };

      // Each row gets its own savepoint - a bad row (e.g. a barcode that
      // collides with another product's) rolls back just that row instead
      // of aborting every valid row already processed in this same
      // transaction.
      await conn.query('SAVEPOINT row_import');
      try {
        if (existing) {
          await updateProductFields(conn, existing.id, fields);
          await addProductUnits(conn, existing.id, unitIds);
          updated++;
        } else {
          const productId = await insertProduct(conn, fields);
          await addProductUnits(conn, productId, unitIds);
          created++;
        }

        if (unknownCodes.length > 0) {
          errors.push({ row: rowNo, message: `Unrecognized unit code(s) ignored: ${unknownCodes.join(', ')}` });
        }
      } catch (rowErr) {
        await conn.query('ROLLBACK TO SAVEPOINT row_import');
        errors.push({
          row: rowNo,
          message: `Row skipped: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`,
        });
      }
    }

    await conn.commit();
    await auditLog('IMPORT_CSV', 'products', null, { created, updated, error_count: errors.length });
    sendJson(res, { success: true, created, updated, errors });
  } catch (err) {
    await conn.rollback();
    sendError(res, `Import failed: ${err instanceof Error ? err.message : String(err)}`, 500);
  } finally {
    conn.release();
  }
}
