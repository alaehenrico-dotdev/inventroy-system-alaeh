// Mirrors Controllers/AuthController.php - POST /api/login
//
// Ported as-is: no session/token is issued here, matching what the
// frontend actually does today (stores the returned `user` object in
// localStorage, attaches nothing to later requests). This is a
// pre-existing gap in the original design, not something introduced by
// this migration - worth a follow-up conversation, not part of this port.
import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { query } from '../db/pool.js';
import { auditLog } from '../support/audit.js';
import { requireFields, sendError, sendJson } from '../support/http.js';

interface UserRow {
  id: number;
  name: string;
  username: string;
  password_hash: string;
  role: string;
  packer_no: number | null;
  active: number;
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, any>;
  if (requireFields(res, body, ['username', 'password'])) return;

  const rows = await query<UserRow>(
    'SELECT * FROM users WHERE username = :u AND active = 1',
    { u: body.username },
  );
  const user = rows[0];

  const passwordOk = user ? await bcrypt.compare(String(body.password), user.password_hash) : false;
  if (!user || !passwordOk) {
    sendError(res, 'Invalid username or password', 401);
    return;
  }

  await auditLog('LOGIN', 'users', user.id);
  sendJson(res, {
    success: true,
    user: { id: user.id, name: user.name, username: user.username, role: user.role, packer_no: user.packer_no },
  });
}
