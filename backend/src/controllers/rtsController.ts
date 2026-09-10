// Mirrors Controllers/RtsController.php - GET/POST /api/rts-triage
import type { Request, Response } from 'express';
import { pool, query } from '../db/pool.js';
import { auditLog } from '../support/audit.js';
import { adjust } from '../domain/channelInventory.js';
import { requireFields, sendError, sendJson } from '../support/http.js';

// Only these two categories restock ONLINE; LEAK/BAD_ORDER are write-offs
// (still logged for reporting, e.g. FulfillmentController's qty_rts, but
// excluded from channel_inventory).
const RESTOCKING_CATEGORIES = new Set(['GOOD', 'UNSORTED']);

export async function index(req: Request, res: Response): Promise<void> {
  if (req.method === 'POST') {
    return create(req, res);
  }

  const date = req.query.date as string | undefined;
  const rows = await query(
    `SELECT r.id, r.logged_at, p.name AS product_name, u.code AS unit_code, r.quantity, r.category, r.notes
     FROM rts_triage r
     JOIN products p ON p.id = r.product_id
     JOIN units u ON u.id = r.unit_id
     ${date ? 'WHERE DATE(r.logged_at) = :date' : ''}
     ORDER BY r.logged_at DESC`,
    date ? { date } : undefined,
  );
  sendJson(res, rows);
}

async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['product_id', 'unit_id', 'quantity'])) return;

  const category = (body.category as string) || 'UNSORTED';
  const restocks = RESTOCKING_CATEGORIES.has(category);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute<any>(
      'INSERT INTO rts_triage (product_id, unit_id, quantity, category, notes) VALUES (:product_id, :unit_id, :quantity, :category, :notes)',
      {
        product_id: body.product_id,
        unit_id: body.unit_id,
        quantity: body.quantity,
        category,
        notes: body.notes ?? null,
      },
    );
    const id = result.insertId as number;

    if (restocks) {
      await adjust(conn, Number(body.product_id), Number(body.unit_id), 'ONLINE', Number(body.quantity));
    }

    await conn.commit();
    await auditLog('LOG_RTS', 'rts_triage', id, { ...body, category, restocked: restocks });
    sendJson(res, { success: true, id, restocked: restocks }, 201);
  } catch (err) {
    await conn.rollback();
    sendError(res, `Failed to log RTS: ${err instanceof Error ? err.message : String(err)}`, 500);
  } finally {
    conn.release();
  }
}
