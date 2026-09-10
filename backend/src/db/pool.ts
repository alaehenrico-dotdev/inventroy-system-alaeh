// ============================================================
// MySQL connection pool - mirrors the old Support/Database.php
// singleton PDO. Use pool.getConnection() for anything that needs
// a transaction / SELECT ... FOR UPDATE (same connection for the
// whole transaction); use pool.execute() directly for one-off
// statements.
// ============================================================
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  charset: `${env.DB_CHARSET}_general_ci`,
  decimalNumbers: true, // DECIMAL(10,2) columns come back as JS numbers, matching PHP's (float) casts
  namedPlaceholders: true,
});

// Thin convenience wrapper for one-off SELECTs outside a transaction -
// returns just the rows, typed as whatever shape the caller expects.
export async function query<T = any>(sql: string, params?: Record<string, any>): Promise<T[]> {
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

// Same, for a single-statement INSERT/UPDATE/DELETE outside a transaction -
// returns the ResultSetHeader (insertId, affectedRows, etc).
export async function exec(sql: string, params?: Record<string, any>): Promise<mysql.ResultSetHeader> {
  const [result] = await pool.execute(sql, params);
  return result as mysql.ResultSetHeader;
}
