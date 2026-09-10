// Mirrors Controllers/Logistics/ReceiptCloseController.php -
// POST /api/logistics/receipts/close
import type { Request, Response } from 'express';
import { pool } from '../../db/pool.js';
import { auditLog } from '../../support/audit.js';
import { requireFields, sendError, sendJson } from '../../support/http.js';

export async function close(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['receipt_id'])) return;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute<any[]>(
      'SELECT * FROM logistics_receipts WHERE id = :id FOR UPDATE',
      { id: body.receipt_id },
    );
    const receipt = rows[0];
    if (!receipt) {
      await conn.rollback();
      sendError(res, 'Receipt not found', 404);
      return;
    }
    if (receipt.status === 'CLOSED') {
      await conn.rollback();
      sendError(res, 'Receipt already closed', 409);
      return;
    }

    await conn.execute(
      'UPDATE logistics_receipts SET status = "CLOSED", closed_at = NOW() WHERE id = :id',
      { id: body.receipt_id },
    );

    await conn.commit();
    await auditLog('CLOSE_RECEIPT', 'logistics_receipts', Number(body.receipt_id));
    sendJson(res, { success: true });
  } catch (err) {
    await conn.rollback();
    sendError(res, `Failed to close receipt: ${err instanceof Error ? err.message : String(err)}`, 500);
  } finally {
    conn.release();
  }
}
