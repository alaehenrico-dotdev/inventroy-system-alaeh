// Mirrors Controllers/TransferController.php - GET/POST/PUT /api/transfers
import type { Request, Response } from 'express';
import { pool, query } from '../db/pool.js';
import { auditLog } from '../support/audit.js';
import { adjust, type Channel } from '../domain/channelInventory.js';
import { requireFields, sendError, sendJson } from '../support/http.js';

// Hardcoded, same as the PHP version: transfers at or above this quantity
// require admin approval (PUT /api/transfers) before the balance moves.
const APPROVAL_THRESHOLD = 200;

export async function index(req: Request, res: Response): Promise<void> {
  if (req.method === 'POST') return create(req, res);
  if (req.method === 'PUT') return approve(req, res);

  const rows = await query(
    `SELECT t.id, t.created_at, p.name AS product_name, u.code AS unit_code,
            t.source_channel, t.destination_channel, t.quantity, t.reason_code, t.status
     FROM inter_channel_transfers t
     JOIN products p ON p.id = t.product_id
     JOIN units u ON u.id = t.unit_id
     ORDER BY t.created_at DESC`,
  );
  sendJson(res, rows);
}

async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['product_id', 'unit_id', 'source_channel', 'destination_channel', 'quantity', 'reason_code'])) return;

  if (body.source_channel === body.destination_channel) {
    sendError(res, 'source_channel and destination_channel must differ', 422);
    return;
  }

  const quantity = Number(body.quantity);
  const status = quantity >= APPROVAL_THRESHOLD ? 'PENDING_APPROVAL' : 'CLEARED';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [balanceRows] = await conn.execute<any[]>(
      'SELECT quantity FROM channel_inventory WHERE product_id = :p AND unit_id = :u AND channel = :c',
      { p: body.product_id, u: body.unit_id, c: body.source_channel },
    );
    const available = balanceRows[0]?.quantity ?? 0;

    // Runs regardless of approval status - even a PENDING_APPROVAL transfer
    // is blocked up front if the source doesn't have enough right now, even
    // though the actual balance won't move until approved. Same as the PHP
    // version.
    if (available < quantity) {
      await conn.rollback();
      sendError(res, `Insufficient stock in ${body.source_channel}: available ${available}`, 422);
      return;
    }

    const [result] = await conn.execute<any>(
      `INSERT INTO inter_channel_transfers
       (product_id, unit_id, source_channel, destination_channel, quantity, reason_code, status)
       VALUES (:product_id, :unit_id, :source_channel, :destination_channel, :quantity, :reason_code, :status)`,
      { ...body, status },
    );
    const id = result.insertId as number;

    if (status === 'CLEARED') {
      await adjust(conn, Number(body.product_id), Number(body.unit_id), body.source_channel as Channel, -quantity);
      await adjust(conn, Number(body.product_id), Number(body.unit_id), body.destination_channel as Channel, quantity);
    }

    await conn.commit();
    await auditLog(`TRANSFER_${status}`, 'inter_channel_transfers', id, body);
    sendJson(res, { success: true, id, status }, 201);
  } catch (err) {
    await conn.rollback();
    sendError(res, `Failed to create transfer: ${err instanceof Error ? err.message : String(err)}`, 500);
  } finally {
    conn.release();
  }
}

// Approves a pending transfer. Note: does not re-validate that the source
// still has sufficient balance at approval time - it trusts the original
// POST-time check, same as the PHP version.
async function approve(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['id'])) return;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute<any[]>(
      'SELECT * FROM inter_channel_transfers WHERE id = :id FOR UPDATE',
      { id: body.id },
    );
    const transfer = rows[0];
    if (!transfer) {
      await conn.rollback();
      sendError(res, 'Transfer not found', 404);
      return;
    }
    if (transfer.status === 'CLEARED') {
      await conn.rollback();
      sendError(res, 'Transfer already cleared', 409);
      return;
    }

    await adjust(conn, transfer.product_id, transfer.unit_id, transfer.source_channel, -transfer.quantity);
    await adjust(conn, transfer.product_id, transfer.unit_id, transfer.destination_channel, transfer.quantity);
    await conn.execute('UPDATE inter_channel_transfers SET status = "CLEARED" WHERE id = :id', { id: body.id });

    await conn.commit();
    await auditLog('TRANSFER_APPROVED', 'inter_channel_transfers', Number(body.id));
    sendJson(res, { success: true });
  } catch (err) {
    await conn.rollback();
    sendError(res, `Failed to approve transfer: ${err instanceof Error ? err.message : String(err)}`, 500);
  } finally {
    conn.release();
  }
}
