// ============================================================
// Environment config - loads backend/.env (copy .env.example to
// .env and edit it) via dotenv. Falls back to defaults that match
// a stock local MySQL/XAMPP install so the app still runs out of
// the box. Mirrors the old Support/Env.php + config.php.
// ============================================================
import 'dotenv/config';

function get(key: string, fallback: string): string {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

export const env = {
  DB_HOST: get('DB_HOST', 'localhost'),
  DB_PORT: Number(get('DB_PORT', '3306')),
  DB_NAME: get('DB_NAME', 'inventory_system'),
  DB_USER: get('DB_USER', 'root'),
  DB_PASSWORD: get('DB_PASSWORD', ''),
  DB_CHARSET: get('DB_CHARSET', 'utf8mb4'),
  PORT: Number(get('PORT', '4000')),
  ADMIN_USERNAME: get('ADMIN_USERNAME', 'admin'),
  ADMIN_PASSWORD: get('ADMIN_PASSWORD', 'admin123'),
};
