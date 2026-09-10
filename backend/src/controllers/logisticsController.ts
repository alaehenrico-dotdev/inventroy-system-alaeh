// Mirrors Controllers/LogisticsController.php - GET/POST /api/logistics
// Quick single-line offline logistics logging, not tied to a receipt
// manifest (see logistics/receiptController.ts for that). Writes directly
// to logistics_transactions and adjusts the OFFLINE channel balance.
import type { Request, Response } from 'express';
import { pool, query } from '../db/pool.js';
import { auditLog } from '../support/audit.js';
import { adjust } from '../domain/channelInventory.js';
import { guardDuplicateReference } from '../domain/duplicateReference.js';
import { requireFields, sendError, sendJson } from '../support/http.js';

const INCREASING = ['DELIVERY_RECEIPT', 'BACKLOAD'];
const DECREASING = ['UPSELL', 'BAD_ORDER'];

export async function index(req: Request, res: Response): Promise<void> {
  if (req.method === 'POST') {
    return create(req, res);
  }

  const type = req.query.type as string | undefined;
  const rows = await query(
    `SELECT lt.id, lt.logged_at, lt.type, p.name AS product_name, u.code AS unit_code, lt.quantity, lt.reference
     FROM logistics_transactions lt
     JOIN products p ON p.id = lt.product_id
     JOIN units u ON u.id = lt.unit_id
     ${type ? 'WHERE lt.type = :type' : ''}
     ORDER BY lt.logged_at DESC`,
    type ? { type } : undefined,
  );
  sendJson(res, rows);
}

async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['type', 'product_id', 'unit_id', 'quantity'])) return;

  const type = body.type as string;
  if (![...INCREASING, ...DECREASING].includes(type)) {
    sendError(res, 'Invalid transaction type', 422);
    return;
  }

  if (body.reference) {
    const existing = (
      await query(
        'SELECT * FROM logistics_transactions WHERE type = :type AND reference = :reference ORDER BY id DESC LIMIT 1',
        { type, reference: body.reference },
      )
    )[0];
    if (guardDuplicateReference(res, existing, body, 'A transaction with this type and reference already exists.')) return;
  }

  const quantity = Number(body.quantity);
  const delta = INCREASING.includes(type) ? quantity : -quantity;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute<any>(
      'INSERT INTO logistics_transactions (type, product_id, unit_id, quantity, reference) VALUES (:type, :product_id, :unit_id, :quantity, :reference)',
      { type, product_id: body.product_id, unit_id: body.unit_id, quantity, reference: body.reference ?? null },
    );
    const id = result.insertId as number;

    await adjust(conn, Number(body.product_id), Number(body.unit_id), 'OFFLINE', delta);

    await conn.commit();
    await auditLog(`LOGISTICS_${type}`, 'logistics_transactions', id, body);
    sendJson(res, { success: true, id }, 201);
  } catch (err) {
    await conn.rollback();
    sendError(res, `Failed to log transaction: ${err instanceof Error ? err.message : String(err)}`, 500);
  } finally {
    conn.release();
  }
}
