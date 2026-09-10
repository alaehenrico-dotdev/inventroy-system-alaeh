// Mirrors Controllers/Logistics/ReceiptController.php -
// GET/POST /api/logistics/receipts
import type { Request, Response } from 'express';
import { query, exec } from '../../db/pool.js';
import { auditLog } from '../../support/audit.js';
import { guardDuplicateReference } from '../../domain/duplicateReference.js';
import { requireFields, sendError, sendJson } from '../../support/http.js';

export async function index(req: Request, res: Response): Promise<void> {
  if (req.method === 'POST') {
    return create(req, res);
  }

  const id = req.query.id as string | undefined;
  if (id) {
    const receipts = await query(
      'SELECT * FROM logistics_receipts WHERE id = :id',
      { id },
    );
    const receipt = receipts[0];
    if (!receipt) {
      sendError(res, 'Receipt not found', 404);
      return;
    }
    const items = await query(
      `SELECT lt.id, p.name AS product_name, u.code AS unit_code, lt.quantity
       FROM logistics_transactions lt
       JOIN products p ON p.id = lt.product_id
       JOIN units u ON u.id = lt.unit_id
       WHERE lt.receipt_id = :id
       ORDER BY lt.id`,
      { id },
    );
    sendJson(res, { ...receipt, items });
    return;
  }

  const rows = await query(
    `SELECT r.*, (SELECT COUNT(*) FROM logistics_transactions lt WHERE lt.receipt_id = r.id) AS item_count
     FROM logistics_receipts r
     ORDER BY r.opened_at DESC`,
  );
  sendJson(res, rows);
}

async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['reference'])) return;

  const existing = (
    await query(
      'SELECT * FROM logistics_receipts WHERE reference = :reference ORDER BY id DESC LIMIT 1',
      { reference: body.reference },
    )
  )[0];
  if (guardDuplicateReference(res, existing, body, 'A receipt with this reference already exists.')) return;

  const result = await exec(
    'INSERT INTO logistics_receipts (reference, supplier, received_by, status) VALUES (:reference, :supplier, :received_by, "OPEN")',
    { reference: body.reference, supplier: body.supplier ?? null, received_by: body.received_by ?? null },
  );

  await auditLog('OPEN_RECEIPT', 'logistics_receipts', result.insertId, body);
  sendJson(res, { success: true, id: result.insertId }, 201);
}
