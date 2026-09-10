// Mirrors Controllers/AuditTrailController.php - GET /api/audit-trail
import type { Request, Response } from 'express';
import { query } from '../db/pool.js';
import { sendJson } from '../support/http.js';

export async function index(req: Request, res: Response): Promise<void> {
  const requested = Number(req.query.limit ?? 100);
  const limit = Math.min(500, Number.isFinite(requested) && requested > 0 ? requested : 100);

  // LIMIT can't be a bound parameter in a prepared statement in all MySQL
  // drivers - cast to int first (as the PHP version does) so this stays
  // injection-safe despite the string interpolation.
  const rows = await query(`SELECT * FROM audit_log ORDER BY id DESC LIMIT ${limit}`);
  sendJson(res, rows);
}
