// Mirrors Controllers/PackersController.php - GET/POST /api/packers
import type { Request, Response } from 'express';
import { exec, query } from '../db/pool.js';
import { auditLog } from '../support/audit.js';
import { requireFields, sendJson } from '../support/http.js';

export async function index(req: Request, res: Response): Promise<void> {
  if (req.method === 'POST') {
    return create(req, res);
  }
  const rows = await query('SELECT * FROM packers ORDER BY packer_no');
  sendJson(res, rows);
}

async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['packer_no'])) return;

  // Upsert on packer_no - matches the PHP version's reliance on MySQL's
  // ON DUPLICATE KEY UPDATE + lastInsertId() quirk (returns the existing
  // row's id when the update branch fires, for an auto-increment PK matched
  // by unique key).
  const result = await exec(
    'INSERT INTO packers (packer_no, name, active) VALUES (:packer_no, :name, 1) ON DUPLICATE KEY UPDATE name = VALUES(name)',
    { packer_no: body.packer_no, name: body.name ?? null },
  );

  await auditLog('CREATE', 'packers', result.insertId || null, body);
  sendJson(res, { success: true }, 201);
}
