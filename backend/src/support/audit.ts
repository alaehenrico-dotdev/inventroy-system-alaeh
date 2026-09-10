// ============================================================
// Append-only audit log - mirrors the old Support/Audit.php.
// Accepts an optional connection so it can participate in a
// caller's already-open transaction; falls back to the pool.
// ============================================================
import type { Pool, PoolConnection } from 'mysql2/promise';
import { pool } from '../db/pool.js';

export async function auditLog(
  action: string,
  entity: string,
  entityId: number | string | null,
  details?: unknown,
  conn?: PoolConnection | Pool,
): Promise<void> {
  const executor = conn ?? pool;
  const detailsValue: string | null =
    details !== undefined && details !== null && typeof details === 'object'
      ? JSON.stringify(details)
      : ((details as string | null | undefined) ?? null);

  await executor.execute(
    'INSERT INTO audit_log (action, entity, entity_id, details) VALUES (:a, :e, :id, :d)',
    { a: action, e: entity, id: entityId, d: detailsValue },
  );
}
