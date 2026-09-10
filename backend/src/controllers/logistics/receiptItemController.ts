// Mirrors Controllers/Logistics/ReceiptItemController.php -
// GET/POST/DELETE /api/logistics/receipts/items
//
// Unlike Ospr/ItemController's DELETE, this one DOES reverse its OFFLINE
// balance adjustment when a line is removed - that asymmetry is
// intentional in the original PHP and preserved here.
import type { Request, Response } from 'express';
import { pool, query } from '../../db/pool.js';
import { auditLog } from '../../support/audit.js';
import { adjust } from '../../domain/channelInventory.js';
import { requireFields, sendError, sendJson } from '../../support/http.js';

export async function index(req: Request, res: Response): Promise<void> {
  if (req.method === 'POST') return create(req, res);
  if (req.method === 'DELETE') return remove(req, res);

  const receiptId = req.query.receipt_id as string | undefined;
  if (!receiptId) {
    sendError(res, 'Missing required field: receipt_id', 422);
    return;
  }

  const rows = await query(
    `SELECT lt.id, p.name AS product_name, u.code AS unit_code, lt.quantity
     FROM logistics_transactions lt
     JOIN products p ON p.id = lt.product_id
     JOIN units u ON u.id = lt.unit_id
     WHERE lt.receipt_id = :receipt_id
     ORDER BY lt.id`,
    { receipt_id: receiptId },
  );
  sendJson(res, rows);
}

async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['receipt_id', 'product_id', 'unit_id', 'quantity'])) return;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [receiptRows] = await conn.execute<any[]>(
      'SELECT status FROM logistics_receipts WHERE id = :id FOR UPDATE',
      { id: body.receipt_id },
    );
    const receipt = receiptRows[0];
    if (!receipt) {
      await conn.rollback();
      sendError(res, 'Receipt not found', 404);
      return;
    }
    if (receipt.status !== 'OPEN') {
      await conn.rollback();
      sendError(res, 'Receipt is already closed', 409);
      return;
    }

    const [result] = await conn.execute<any>(
      `INSERT INTO logistics_transactions (type, receipt_id, product_id, unit_id, quantity, reference)
       VALUES ('DELIVERY_RECEIPT', :receipt_id, :product_id, :unit_id, :quantity, NULL)`,
      { receipt_id: body.receipt_id, product_id: body.product_id, unit_id: body.unit_id, quantity: body.quantity },
    );
    const id = result.insertId as number;

    await adjust(conn, Number(body.product_id), Number(body.unit_id), 'OFFLINE', Number(body.quantity));

    await conn.commit();
    await auditLog('ADD_RECEIPT_ITEM', 'logistics_transactions', id, body);
    sendJson(res, { success: true, id }, 201);
  } catch (err) {
    await conn.rollback();
    sendError(res, `Failed to add receipt item: ${err instanceof Error ? err.message : String(err)}`, 500);
  } finally {
    conn.release();
  }
}

async function remove(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['id'])) return;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute<any[]>(
      `SELECT lt.*, r.status AS receipt_status
       FROM logistics_transactions lt
       JOIN logistics_receipts r ON r.id = lt.receipt_id
       WHERE lt.id = :id FOR UPDATE`,
      { id: body.id },
    );
    const item = rows[0];
    if (!item) {
      await conn.rollback();
      sendError(res, 'Receipt item not found', 404);
      return;
    }
    if (item.receipt_status !== 'OPEN') {
      await conn.rollback();
      sendError(res, 'Receipt is already closed', 409);
      return;
    }

    await conn.execute('DELETE FROM logistics_transactions WHERE id = :id', { id: body.id });
    await adjust(conn, item.product_id, item.unit_id, 'OFFLINE', -item.quantity);

    await conn.commit();
    await auditLog('DELETE_RECEIPT_ITEM', 'logistics_transactions', Number(body.id));
    sendJson(res, { success: true });
  } catch (err) {
    await conn.rollback();
    sendError(res, `Failed to delete receipt item: ${err instanceof Error ? err.message : String(err)}`, 500);
  } finally {
    conn.release();
  }
}
