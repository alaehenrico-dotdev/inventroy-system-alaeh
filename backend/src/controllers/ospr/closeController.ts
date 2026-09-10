// Mirrors Controllers/Ospr/CloseController.php - POST /api/ospr/close
// Closes a batch and auto-computes the Accomplishment Report totals from
// logged items - no manual re-entry.
import type { Request, Response } from 'express';
import { pool } from '../../db/pool.js';
import { auditLog } from '../../support/audit.js';
import { requireFields, sendError, sendJson } from '../../support/http.js';

// Magic unit-code -> accomplishment-field mapping, driven by string equality
// against units.code (not unit_id) - must match exactly, same as the PHP
// version. Missing codes stay 0 rather than being absent from the totals.
const UNIT_CODE_TO_FIELD: Record<string, string> = {
  GAL: 'qty_gal',
  LIT: 'qty_lit',
  '750ML': 'qty_750',
  '350ML': 'qty_350',
  KG: 'qty_1kg_salt',
};

export async function close(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['batch_id'])) return;

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
    if (batch.status === 'CLOSED') {
      await conn.rollback();
      sendError(res, 'Batch already closed', 409);
      return;
    }

    const timeEnded = (body.time_ended as string) || new Date().toTimeString().slice(0, 8);
    await conn.execute(
      "UPDATE ospr_batches SET packed_by = :packed_by, time_ended = :time_ended, status = 'CLOSED' WHERE id = :id",
      { packed_by: body.packed_by ?? null, time_ended: timeEnded, id: body.batch_id },
    );

    const [unitTotals] = await conn.execute<any[]>(
      `SELECT u.code, SUM(oi.quantity) AS total
       FROM ospr_order_items oi
       JOIN units u ON u.id = oi.unit_id
       WHERE oi.batch_id = :id
       GROUP BY u.code`,
      { id: body.batch_id },
    );

    const totals: Record<string, number> = { qty_gal: 0, qty_lit: 0, qty_750: 0, qty_350: 0, qty_1kg_salt: 0 };
    for (const row of unitTotals) {
      const field = UNIT_CODE_TO_FIELD[row.code];
      if (field) totals[field] = Number(row.total);
    }

    const [countRows] = await conn.execute<any[]>(
      `SELECT COUNT(*) AS pcs, COUNT(DISTINCT code_name) AS parcels
       FROM ospr_order_items WHERE batch_id = :id`,
      { id: body.batch_id },
    );
    const totalPcsParcel = Number(countRows[0]?.pcs ?? 0);
    const totalParcelPacked = Number(countRows[0]?.parcels ?? 0);

    await conn.execute(
      `INSERT INTO ospr_accomplishment
         (batch_id, total_pcs_parcel, total_parcel_packed, qty_gal, qty_lit, qty_750, qty_350, qty_1kg_salt)
       VALUES (:batch_id, :total_pcs_parcel, :total_parcel_packed, :qty_gal, :qty_lit, :qty_750, :qty_350, :qty_1kg_salt)
       ON DUPLICATE KEY UPDATE
         total_pcs_parcel = VALUES(total_pcs_parcel), total_parcel_packed = VALUES(total_parcel_packed),
         qty_gal = VALUES(qty_gal), qty_lit = VALUES(qty_lit), qty_750 = VALUES(qty_750),
         qty_350 = VALUES(qty_350), qty_1kg_salt = VALUES(qty_1kg_salt), computed_at = NOW()`,
      { batch_id: body.batch_id, total_pcs_parcel: totalPcsParcel, total_parcel_packed: totalParcelPacked, ...totals },
    );

    const boxesUsed = body.boxes_used;
    if (Array.isArray(boxesUsed) && boxesUsed.length > 0) {
      for (const entry of boxesUsed as Array<Record<string, any>>) {
        if (!entry.packer_id) continue;
        await conn.execute(
          `INSERT INTO ospr_boxes_used (batch_id, packer_id, box_count) VALUES (:batch_id, :packer_id, :box_count)
           ON DUPLICATE KEY UPDATE box_count = VALUES(box_count)`,
          { batch_id: body.batch_id, packer_id: entry.packer_id, box_count: entry.box_count ?? 0 },
        );
      }
    }

    await conn.commit();
    await auditLog('CLOSE_BATCH', 'ospr_batches', Number(body.batch_id));
    sendJson(res, {
      success: true,
      accomplishment: { total_pcs_parcel: totalPcsParcel, total_parcel_packed: totalParcelPacked, ...totals },
    });
  } catch (err) {
    await conn.rollback();
    sendError(res, `Failed to close batch: ${err instanceof Error ? err.message : String(err)}`, 500);
  } finally {
    conn.release();
  }
}
