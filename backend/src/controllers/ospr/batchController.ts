// Mirrors Controllers/Ospr/BatchController.php - GET/POST /api/ospr/batches
import type { Request, Response } from 'express';
import { exec, query } from '../../db/pool.js';
import { auditLog } from '../../support/audit.js';
import { requireFields, sendError, sendJson } from '../../support/http.js';

const COURIERS = ['JNT', 'JTE', 'LEX', 'SPX'];

export async function index(req: Request, res: Response): Promise<void> {
  if (req.method === 'POST') {
    return create(req, res);
  }

  const id = req.query.id as string | undefined;
  if (id) {
    const batches = await query(
      `SELECT b.*, pk.packer_no AS packed_by_no
       FROM ospr_batches b
       LEFT JOIN packers pk ON pk.id = b.packed_by
       WHERE b.id = :id`,
      { id },
    );
    const batch = batches[0];
    if (!batch) {
      sendError(res, 'Batch not found', 404);
      return;
    }

    const items = await query(
      `SELECT oi.id, oi.seq_no, oi.code_name, p.name AS product_name, u.code AS unit_code, oi.quantity, oi.customer_name
       FROM ospr_order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN units u ON u.id = oi.unit_id
       WHERE oi.batch_id = :id
       ORDER BY oi.seq_no`,
      { id },
    );
    const accomplishment = (await query('SELECT * FROM ospr_accomplishment WHERE batch_id = :id', { id }))[0] ?? null;
    const boxesUsed = await query(
      `SELECT bu.id, pk.packer_no, bu.box_count
       FROM ospr_boxes_used bu
       JOIN packers pk ON pk.id = bu.packer_id
       WHERE bu.batch_id = :id
       ORDER BY pk.packer_no`,
      { id },
    );

    sendJson(res, { ...batch, items, accomplishment, boxes_used: boxesUsed });
    return;
  }

  const rows = await query(
    `SELECT b.*, pk.packer_no AS packed_by_no,
            (SELECT COUNT(*) FROM ospr_order_items oi WHERE oi.batch_id = b.id) AS item_count
     FROM ospr_batches b
     LEFT JOIN packers pk ON pk.id = b.packed_by
     ORDER BY b.created_at DESC`,
  );
  sendJson(res, rows);
}

async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['batch_date'])) return;

  // The PHP version left `courier` to MySQL's ENUM to reject (an uncaught
  // fatal, since BatchController::POST had no try/catch at all) - validating
  // it here explicitly is a zero-risk improvement.
  if (body.courier && !COURIERS.includes(body.courier as string)) {
    sendError(res, 'Invalid courier', 422);
    return;
  }

  const timeStarted = (body.time_started as string) || new Date().toTimeString().slice(0, 8);

  const result = await exec(
    `INSERT INTO ospr_batches (batch_date, prepared_by, courier, time_started, status)
     VALUES (:batch_date, :prepared_by, :courier, :time_started, 'OPEN')`,
    {
      batch_date: body.batch_date,
      prepared_by: body.prepared_by ?? null,
      courier: body.courier ?? null,
      time_started: timeStarted,
    },
  );

  await auditLog('OPEN_BATCH', 'ospr_batches', result.insertId, body);
  sendJson(res, { success: true, id: result.insertId }, 201);
}
