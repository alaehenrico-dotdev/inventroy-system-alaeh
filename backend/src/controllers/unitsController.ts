// Mirrors Controllers/UnitsController.php - GET /api/units
import type { Request, Response } from 'express';
import { query } from '../db/pool.js';
import { sendJson } from '../support/http.js';

export async function index(_req: Request, res: Response): Promise<void> {
  const rows = await query('SELECT * FROM units ORDER BY id');
  sendJson(res, rows);
}
