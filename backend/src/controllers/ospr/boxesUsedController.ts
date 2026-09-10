// Mirrors Controllers/Ospr/BoxesUsedController.php -
// GET/POST /api/ospr/boxes-used
import type { Request, Response } from 'express';
import { exec, query } from '../../db/pool.js';
import { auditLog } from '../../support/audit.js';
import { requireFields, sendError, sendJson } from '../../support/http.js';

export async function index(req: Request, res: Response): Promise<void> {
  if (req.method === 'POST') {
    return create(req, res);
  }

  const batchId = req.query.batch_id as string | undefined;
  if (!batchId) {
    sendError(res, 'Missing required field: batch_id', 422);
    return;
  }

  const rows = await query(
    `SELECT bu.id, pk.packer_no, bu.box_count
     FROM ospr_boxes_used bu
     JOIN packers pk ON pk.id = bu.packer_id
     WHERE bu.batch_id = :batch_id
     ORDER BY pk.packer_no`,
    { batch_id: batchId },
  );
  sendJson(res, rows);
}

async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['batch_id', 'packer_id', 'box_count'])) return;

  // Upsert, no transaction needed (single statement) - same as the PHP
  // version. entity_id is always null in the audit row: lastInsertId()
  // isn't reliable after ON DUPLICATE KEY UPDATE when the update branch
  // fires, so the original doesn't bother trying.
  await exec(
    `INSERT INTO ospr_boxes_used (batch_id, packer_id, box_count) VALUES (:batch_id, :packer_id, :box_count)
     ON DUPLICATE KEY UPDATE box_count = VALUES(box_count)`,
    body,
  );

  await auditLog('LOG_BOXES', 'ospr_boxes_used', null, body);
  sendJson(res, { success: true }, 201);
}
