// Mirrors Controllers/WithdrawalController.php - GET/POST /api/withdrawals
import type { Request, Response } from 'express';
import { pool, query } from '../db/pool.js';
import { auditLog } from '../support/audit.js';
import { adjust } from '../domain/channelInventory.js';
import { requireFields, sendError, sendJson } from '../support/http.js';

const SHIFTS = ['AM', 'PM'] as const;

export async function index(req: Request, res: Response): Promise<void> {
  if (req.method === 'POST') {
    return create(req, res);
  }

  const { date, shift, packer_id: packerId } = req.query as Record<string, string | undefined>;
  const clauses: string[] = [];
  const params: Record<string, any> = {};
  if (date) { clauses.push('DATE(w.withdrawn_at) = :date'); params.date = date; }
  if (shift) { clauses.push('w.shift = :shift'); params.shift = shift; }
  if (packerId) { clauses.push('w.packer_id = :packer_id'); params.packer_id = packerId; }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = await query(
    `SELECT w.id, w.withdrawn_at, w.shift, pk.packer_no, p.name AS product_name, u.code AS unit_code, w.quantity
     FROM withdrawals w
     JOIN packers pk ON pk.id = w.packer_id
     JOIN products p ON p.id = w.product_id
     JOIN units u ON u.id = w.unit_id
     ${where}
     ORDER BY w.withdrawn_at DESC`,
    params,
  );
  sendJson(res, rows);
}

async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['shift', 'packer_id', 'product_id', 'unit_id', 'quantity'])) return;

  // The PHP version left `shift` to MySQL's ENUM to reject (an uncaught 500
  // on typos) - validating it here explicitly is a zero-risk improvement:
  // valid input behaves identically, invalid input now gets a clean 422.
  if (!SHIFTS.includes(body.shift as any)) {
    sendError(res, 'Invalid shift', 422);
    return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute<any>(
      'INSERT INTO withdrawals (shift, packer_id, product_id, unit_id, quantity) VALUES (:shift, :packer_id, :product_id, :unit_id, :quantity)',
      body,
    );
    const id = result.insertId as number;

    await adjust(conn, Number(body.product_id), Number(body.unit_id), 'ONLINE', Number(body.quantity));

    await conn.commit();
    await auditLog('WITHDRAW', 'withdrawals', id, body);
    sendJson(res, { success: true, id }, 201);
  } catch (err) {
    await conn.rollback();
    sendError(res, `Failed to log withdrawal: ${err instanceof Error ? err.message : String(err)}`, 500);
  } finally {
    conn.release();
  }
}
