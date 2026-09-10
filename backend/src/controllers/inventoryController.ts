// Mirrors Controllers/InventoryController.php -
// GET/PUT /api/channel-inventory, GET /api/stock-alerts
import type { Request, Response } from 'express';
import { exec, query } from '../db/pool.js';
import { auditLog } from '../support/audit.js';
import { sendError, sendJson } from '../support/http.js';

const SELECT_BASE = `
  SELECT ci.id, ci.product_id, p.name AS product_name, p.category,
         ci.unit_id, u.code AS unit_code, u.label AS unit_label,
         ci.channel, ci.quantity, ci.low_stock_threshold, ci.updated_at
  FROM channel_inventory ci
  JOIN products p ON p.id = ci.product_id
  JOIN units u ON u.id = ci.unit_id
`;

export async function index(req: Request, res: Response): Promise<void> {
  if (req.method === 'PUT') {
    return update(req, res);
  }

  const channel = req.query.channel as string | undefined;
  const rows = channel
    ? await query(`${SELECT_BASE} WHERE ci.channel = :channel ORDER BY p.name, u.id`, { channel })
    : await query(`${SELECT_BASE} ORDER BY p.name, u.id`);
  sendJson(res, rows);
}

// Manual correction. Comment in the original PHP says "Admin only in a full
// build" but that was never enforced there either - preserved as-is.
async function update(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (!('id' in body) || body.id === '' || body.id === null) {
    sendError(res, 'Missing required field: id', 422);
    return;
  }

  const sets: string[] = [];
  const params: Record<string, any> = { id: body.id };
  if ('quantity' in body && body.quantity !== null && body.quantity !== '') {
    sets.push('quantity = :quantity');
    params.quantity = body.quantity;
  }
  if ('low_stock_threshold' in body && body.low_stock_threshold !== null && body.low_stock_threshold !== '') {
    sets.push('low_stock_threshold = :low_stock_threshold');
    params.low_stock_threshold = body.low_stock_threshold;
  }

  if (sets.length === 0) {
    sendError(res, 'Nothing to update', 422);
    return;
  }

  // No existence check, same as the PHP version - a nonexistent id silently
  // no-ops (0 rows affected) but still reports success.
  await exec(`UPDATE channel_inventory SET ${sets.join(', ')} WHERE id = :id`, params);
  await auditLog('UPDATE', 'channel_inventory', body.id as number, body);
  sendJson(res, { success: true });
}

export async function lowStock(_req: Request, res: Response): Promise<void> {
  const rows = await query(
    `${SELECT_BASE} WHERE ci.quantity <= ci.low_stock_threshold ORDER BY (ci.low_stock_threshold - ci.quantity) DESC`,
  );
  sendJson(res, rows);
}
