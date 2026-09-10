// ============================================================
// Response helpers - mirrors the old Support/Http.php. Success
// bodies are raw arrays/objects (no envelope); errors are always
// {"error": "message"}.
// ============================================================
import type { Response } from 'express';

export function sendJson(res: Response, data: unknown, status = 200): void {
  res.status(status).json(data);
}

export function sendError(res: Response, message: string, status = 400): void {
  sendJson(res, { error: message }, status);
}

// Treats '' and null as missing, same as the PHP version - but NOT 0 or
// false, since those are legitimate values for quantity/box_count/etc.
// Returns the name of the first missing field, or null if all present.
export function firstMissingField(data: Record<string, unknown>, fields: string[]): string | null {
  for (const f of fields) {
    if (!(f in data) || data[f] === '' || data[f] === null || data[f] === undefined) {
      return f;
    }
  }
  return null;
}

// Returns true and sends the 422 error itself if a field is missing -
// callers do `if (requireFields(res, body, [...])) return;`
export function requireFields(res: Response, data: Record<string, unknown>, fields: string[]): boolean {
  const missing = firstMissingField(data, fields);
  if (missing) {
    sendError(res, `Missing required field: ${missing}`, 422);
    return true;
  }
  return false;
}
