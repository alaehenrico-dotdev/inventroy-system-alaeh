// Mirrors Controllers/FulfillmentController.php -
// GET/POST /api/fulfillment-daily
// Fulfillment(OUT) vs RTS per product/unit for a date.
import type { Request, Response } from 'express';
import { pool, query } from '../db/pool.js';
import { auditLog } from '../support/audit.js';
import { requireFields, sendError, sendJson } from '../support/http.js';

interface RollupItem {
  product_id: number;
  unit_id: number;
  product_name?: string;
  unit_code?: string;
  qty_out: number;
  qty_rts: number;
}

interface Rollup {
  items: RollupItem[];
  total_parcel: number;
  total_packers: number;
}

async function computeRollup(date: string): Promise<Rollup> {
  const outRows = await query<any>(
    `SELECT oi.product_id, oi.unit_id, SUM(oi.quantity) AS total
     FROM ospr_order_items oi
     JOIN ospr_batches b ON b.id = oi.batch_id
     WHERE b.batch_date = :date
     GROUP BY oi.product_id, oi.unit_id`,
    { date },
  );
  const rtsRows = await query<any>(
    `SELECT product_id, unit_id, SUM(quantity) AS total
     FROM rts_triage
     WHERE DATE(logged_at) = :date
     GROUP BY product_id, unit_id`,
    { date },
  );

  const byKey = new Map<string, RollupItem>();
  const keyOf = (productId: number, unitId: number) => `${productId}:${unitId}`;

  for (const row of outRows) {
    byKey.set(keyOf(row.product_id, row.unit_id), {
      product_id: row.product_id,
      unit_id: row.unit_id,
      qty_out: Number(row.total),
      qty_rts: 0,
    });
  }
  for (const row of rtsRows) {
    const key = keyOf(row.product_id, row.unit_id);
    const existing = byKey.get(key);
    if (existing) {
      existing.qty_rts = Number(row.total);
    } else {
      byKey.set(key, { product_id: row.product_id, unit_id: row.unit_id, qty_out: 0, qty_rts: Number(row.total) });
    }
  }

  const items = Array.from(byKey.values());

  // Attach product_name/unit_code with one batch query instead of the PHP
  // version's per-row lookup loop - output shape is unchanged.
  if (items.length > 0) {
    const productIds = [...new Set(items.map((i) => i.product_id))];
    const unitIds = [...new Set(items.map((i) => i.unit_id))];
    const products = await query<any>(
      `SELECT id, name FROM products WHERE id IN (${productIds.map((_, i) => `:p${i}`).join(',')})`,
      Object.fromEntries(productIds.map((id, i) => [`p${i}`, id])),
    );
    const units = await query<any>(
      `SELECT id, code FROM units WHERE id IN (${unitIds.map((_, i) => `:u${i}`).join(',')})`,
      Object.fromEntries(unitIds.map((id, i) => [`u${i}`, id])),
    );
    const productNames = new Map(products.map((p) => [p.id, p.name]));
    const unitCodes = new Map(units.map((u) => [u.id, u.code]));
    for (const item of items) {
      item.product_name = productNames.get(item.product_id);
      item.unit_code = unitCodes.get(item.unit_id);
    }
  }

  const totalsRow = (
    await query<any>(
      `SELECT COUNT(DISTINCT oi.code_name) AS total_parcel, COUNT(DISTINCT b.packed_by) AS total_packers
       FROM ospr_order_items oi
       JOIN ospr_batches b ON b.id = oi.batch_id
       WHERE b.batch_date = :date`,
      { date },
    )
  )[0] ?? { total_parcel: 0, total_packers: 0 };

  return {
    items,
    total_parcel: Number(totalsRow.total_parcel),
    total_packers: Number(totalsRow.total_packers),
  };
}

export async function index(req: Request, res: Response): Promise<void> {
  if (req.method === 'POST') {
    return persist(req, res);
  }

  const date = (req.query.date as string | undefined) || new Date().toISOString().slice(0, 10);
  sendJson(res, await computeRollup(date));
}

async function persist(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['date'])) return;
  const date = body.date as string;

  const rollup = await computeRollup(date);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO fulfillment_daily (summary_date, total_parcel, total_packers)
       VALUES (:date, :total_parcel, :total_packers)
       ON DUPLICATE KEY UPDATE total_parcel = VALUES(total_parcel), total_packers = VALUES(total_packers), generated_at = NOW()`,
      { date, total_parcel: rollup.total_parcel, total_packers: rollup.total_packers },
    );
    const [idRows] = await conn.execute<any[]>(
      'SELECT id FROM fulfillment_daily WHERE summary_date = :date',
      { date },
    );
    const fulfillmentDailyId = idRows[0].id as number;

    for (const item of rollup.items) {
      await conn.execute(
        `INSERT INTO fulfillment_daily_items (fulfillment_daily_id, product_id, unit_id, qty_out, qty_rts)
         VALUES (:fdid, :product_id, :unit_id, :qty_out, :qty_rts)
         ON DUPLICATE KEY UPDATE qty_out = VALUES(qty_out), qty_rts = VALUES(qty_rts)`,
        { fdid: fulfillmentDailyId, product_id: item.product_id, unit_id: item.unit_id, qty_out: item.qty_out, qty_rts: item.qty_rts },
      );
    }

    await conn.commit();
    await auditLog('GENERATE_FULFILLMENT_SUMMARY', 'fulfillment_daily', fulfillmentDailyId, { date });
    sendJson(res, { success: true, id: fulfillmentDailyId, rollup }, 201);
  } catch (err) {
    await conn.rollback();
    sendError(res, `Failed to persist summary: ${err instanceof Error ? err.message : String(err)}`, 500);
  } finally {
    conn.release();
  }
}
