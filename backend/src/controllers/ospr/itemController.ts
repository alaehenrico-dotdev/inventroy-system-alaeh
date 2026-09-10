// Mirrors Controllers/Ospr/ItemController.php - GET/POST/DELETE /api/ospr/items
import type { Request, Response } from 'express';
import { exec, pool, query } from '../../db/pool.js';
import { auditLog } from '../../support/audit.js';
import { adjust } from '../../domain/channelInventory.js';
import { requireFields, sendError, sendJson } from '../../support/http.js';

export async function index(req: Request, res: Response): Promise<void> {
  if (req.method === 'POST') return create(req, res);
  if (req.method === 'DELETE') return remove(req, res);

  const batchId = req.query.batch_id as string | undefined;
  if (!batchId) {
    sendError(res, 'Missing required field: batch_id', 422);
    return;
  }

  const rows = await query(
    `SELECT oi.id, oi.seq_no, oi.code_name, p.name AS product_name, u.code AS unit_code, oi.quantity, oi.customer_name
     FROM ospr_order_items oi
     JOIN products p ON p.id = oi.product_id
     JOIN units u ON u.id = oi.unit_id
     WHERE oi.batch_id = :batch_id
     ORDER BY oi.seq_no`,
    { batch_id: batchId },
  );
  sendJson(res, rows);
}

async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['batch_id', 'code_name', 'product_id', 'unit_id'])) return;
  const quantity = body.quantity ?? 1;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [batchRows] = await conn.execute<any[]>(
      'SELECT status FROM ospr_batches WHERE id = :id FOR UPDATE',
      { id: body.batch_id },
    );
    const batch = batchRows[0];
    if (!batch) {
      await conn.rollback();
      sendError(res, 'Batch not found', 404);
      return;
    }
    if (batch.status !== 'OPEN') {
      await conn.rollback();
      sendError(res, 'Batch is already closed', 409);
      return;
    }

    const [seqRows] = await conn.execute<any[]>(
      'SELECT MAX(seq_no) AS max_seq FROM ospr_order_items WHERE batch_id = :batch_id',
      { batch_id: body.batch_id },
    );
    const seqNo = (seqRows[0]?.max_seq ?? 0) + 1;

    const [result] = await conn.execute<any>(
      `INSERT INTO ospr_order_items (batch_id, seq_no, code_name, product_id, unit_id, quantity, customer_name)
       VALUES (:batch_id, :seq_no, :code_name, :product_id, :unit_id, :quantity, :customer_name)`,
      { ...body, seq_no: seqNo, quantity, customer_name: body.customer_name ?? null },
    );
    const id = result.insertId as number;

    await adjust(conn, Number(body.product_id), Number(body.unit_id), 'ONLINE', -Number(quantity));

    await conn.commit();
    await auditLog('ADD_ORDER_ITEM', 'ospr_order_items', id, body);
    sendJson(res, { success: true, id, seq_no: seqNo }, 201);
  } catch (err) {
    await conn.rollback();
    sendError(res, `Failed to add order item: ${err instanceof Error ? err.message : String(err)}`, 500);
  } finally {
    conn.release();
  }
}

async function remove(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['id'])) return;

  // TODO(bug, preserved from PHP): unlike logistics/receiptItemController's
  // DELETE, this does NOT reverse the ONLINE channel_inventory adjustment
  // that was made when the item was added, and does not check whether the
  // batch is still OPEN. This is a known, pre-existing gap in the original
  // system (see system-workflows.md) - preserved here for behavior parity
  // rather than silently fixed during the migration.
  await exec('DELETE FROM ospr_order_items WHERE id = :id', { id: body.id });

  await auditLog('DELETE_ORDER_ITEM', 'ospr_order_items', Number(body.id));
  sendJson(res, { success: true });
}
