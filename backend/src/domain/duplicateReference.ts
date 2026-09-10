// ============================================================
// Soft duplicate-reference warning - mirrors
// Domain/Logistics/DuplicateReference.php. Not a uniqueness
// constraint: if the client resends the same payload with
// confirm_duplicate: true, the record proceeds to insert as
// normal. Used by LogisticsController and Logistics/ReceiptController
// POST handlers, before any transaction is opened.
// ============================================================
import type { Response } from 'express';
import { sendError } from '../support/http.js';

// Returns true (and sends the 409 itself) if the guard should stop the
// request - callers do `if (guardDuplicateReference(res, existing, body, msg)) return;`
export function guardDuplicateReference(
  res: Response,
  existing: unknown,
  body: Record<string, unknown>,
  message: string,
): boolean {
  if (existing && !body.confirm_duplicate) {
    res.status(409).json({ error: 'duplicate_reference', message, existing });
    return true;
  }
  return false;
}
