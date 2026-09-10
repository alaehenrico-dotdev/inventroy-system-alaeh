// New: GET/POST /api/pack-logs, GET /api/pack-logs/quota-summary
//
// Per-shift packing quota tracking (Section 8.5, new). A packer logs each
// batch of packs against their shift here - product, unit/SKU, and how many
// were packed - independent of OSPR. Deliberately does NOT touch
// channel_inventory: this is a performance/quota log layered on top of the
// existing withdrawal/OSPR flow, not another source of truth for stock (see
// system-workflows.md - only Withdrawals/OSPR/RTS/Transfers/Logistics move
// channel_inventory balances).
import type { Request, Response } from 'express';
import { pool, query } from '../db/pool.js';
import { auditLog } from '../support/audit.js';
import { requireFields, sendError, sendJson } from '../support/http.js';

const SHIFTS = ['AM', 'PM'] as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function index(req: Request, res: Response): Promise<void> {
  if (req.method === 'POST') return create(req, res);

  const { date, shift, packer_id: packerId } = req.query as Record<string, string | undefined>;
  const clauses: string[] = [];
  const params: Record<string, any> = {};
  if (date) { clauses.push('pl.work_date = :date'); params.date = date; }
  if (shift) { clauses.push('pl.shift = :shift'); params.shift = shift; }
  if (packerId) { clauses.push('pl.packer_id = :packer_id'); params.packer_id = packerId; }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = await query(
    `SELECT pl.id, pl.work_date, pl.shift, pk.packer_no, p.name AS product_name, p.sku,
            u.code AS unit_code, pl.quantity, pl.notes, pl.logged_at
     FROM pack_logs pl
     JOIN packers pk ON pk.id = pl.packer_id
     JOIN products p ON p.id = pl.product_id
     JOIN units u ON u.id = pl.unit_id
     ${where}
     ORDER BY pl.logged_at DESC`,
    params,
  );
  sendJson(res, rows);
}

async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['packer_id', 'shift', 'product_id', 'unit_id'])) return;

  if (!SHIFTS.includes(body.shift as any)) {
    sendError(res, 'Invalid shift', 422);
    return;
  }

  const quantity = body.quantity ?? 1;
  const workDate = body.work_date || today();

  const [result] = await pool.execute<any>(
    `INSERT INTO pack_logs (packer_id, work_date, shift, product_id, unit_id, quantity, notes)
     VALUES (:packer_id, :work_date, :shift, :product_id, :unit_id, :quantity, :notes)`,
    { ...body, work_date: workDate, quantity, notes: body.notes ?? null },
  );
  const id = result.insertId as number;

  await auditLog('LOG_PACKS', 'pack_logs', id, body);
  sendJson(res, { success: true, id }, 201);
}

// Per-packer totals for one shift against their quota, plus a breakdown of
// what they packed (product/SKU/unit) - what the Packing Quota page shows.
// `shift` is required (not just validated when given): the quota is
// defined per-shift, so a combined AM+PM total compared against the same
// single-shift number would under-report how close a packer really is.
export async function quotaSummary(req: Request, res: Response): Promise<void> {
  const date = (req.query.date as string | undefined) || today();
  const shift = req.query.shift as string | undefined;
  if (!shift || !SHIFTS.includes(shift as any)) {
    sendError(res, 'Missing or invalid required field: shift (AM or PM)', 422);
    return;
  }

  const params: Record<string, any> = { date, shift };

  const packers = await query(
    `SELECT pk.id AS packer_id, pk.packer_no, pk.daily_quota,
            COALESCE((SELECT SUM(pl.quantity) FROM pack_logs pl
                      WHERE pl.packer_id = pk.id AND pl.work_date = :date AND pl.shift = :shift), 0) AS total_packed
     FROM packers pk
     WHERE pk.active = 1
     ORDER BY pk.packer_no`,
    params,
  );

  const breakdown = await query(
    `SELECT pl.packer_id, p.name AS product_name, p.sku, u.code AS unit_code, SUM(pl.quantity) AS quantity
     FROM pack_logs pl
     JOIN products p ON p.id = pl.product_id
     JOIN units u ON u.id = pl.unit_id
     WHERE pl.work_date = :date AND pl.shift = :shift
     GROUP BY pl.packer_id, p.id, u.id
     ORDER BY p.name, u.id`,
    params,
  );

  const byPacker = new Map<number, any[]>();
  for (const row of breakdown as any[]) {
    const list = byPacker.get(row.packer_id) ?? [];
    list.push({ product_name: row.product_name, sku: row.sku, unit_code: row.unit_code, quantity: Number(row.quantity) });
    byPacker.set(row.packer_id, list);
  }

  const summary = (packers as any[]).map((pk) => {
    const totalPacked = Number(pk.total_packed);
    const quota = Number(pk.daily_quota);
    return {
      packer_id: pk.packer_id,
      packer_no: pk.packer_no,
      quota,
      total_packed: totalPacked,
      remaining: Math.max(0, quota - totalPacked),
      quota_met: totalPacked >= quota,
      items: byPacker.get(pk.packer_id) ?? [],
    };
  });

  sendJson(res, { date, shift, packers: summary });
}
