// Mirrors Controllers/LogBooksController.php - GET /api/log-books?view=sku|packer
import type { Request, Response } from 'express';
import { query } from '../db/pool.js';
import { sendError, sendJson } from '../support/http.js';

export async function index(req: Request, res: Response): Promise<void> {
  const view = req.query.view as string | undefined;

  if (view === 'packer') {
    const rows = await query(
      `SELECT pk.id AS packer_id, pk.packer_no,
              (SELECT COALESCE(SUM(w.quantity), 0) FROM withdrawals w WHERE w.packer_id = pk.id) AS total_withdrawn,
              (SELECT COALESCE(SUM(bu.box_count), 0) FROM ospr_boxes_used bu WHERE bu.packer_id = pk.id) AS total_boxes_packed,
              (SELECT COUNT(*) FROM ospr_batches b WHERE b.packed_by = pk.id) AS batches_packed
       FROM packers pk
       ORDER BY pk.packer_no`,
    );
    sendJson(res, rows);
    return;
  }

  if (!view || view === 'sku') {
    const rows = await query(
      `SELECT p.name AS product_name, u.code AS unit_code,
              COALESCE(SUM(w.quantity), 0) AS total_withdrawn,
              (SELECT COALESCE(SUM(oi.quantity), 0) FROM ospr_order_items oi
               WHERE oi.product_id = p.id AND oi.unit_id = u.id) AS total_packed
       FROM product_units pu
       JOIN products p ON p.id = pu.product_id
       JOIN units u ON u.id = pu.unit_id
       LEFT JOIN withdrawals w ON w.product_id = p.id AND w.unit_id = u.id
       GROUP BY p.id, u.id
       ORDER BY p.name, u.id`,
    );
    sendJson(res, rows);
    return;
  }

  sendError(res, 'Invalid view - use ?view=sku or ?view=packer', 422);
}
