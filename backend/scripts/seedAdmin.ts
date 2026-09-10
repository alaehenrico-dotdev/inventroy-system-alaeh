// CLI replacement for seed_admin.php - run via `npm run seed:admin`.
// Unlike the original (a web-reachable PHP script meant to be deleted after
// one use, which printed the plaintext credentials over HTTP), this never
// listens on a port - it's a one-shot script, run from a trusted terminal.
import bcrypt from 'bcrypt';
import { env } from '../src/config/env.js';
import { pool } from '../src/db/pool.js';

async function main(): Promise<void> {
  const username = env.ADMIN_USERNAME;
  const password = env.ADMIN_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 10);

  await pool.execute(
    `INSERT INTO users (name, username, password_hash, role)
     VALUES ('Administrator', :username, :password_hash, 'ADMIN')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    { username, password_hash: passwordHash },
  );

  console.log(`Admin user ready - username: ${username}, password: ${password}`);
  console.log('Change ADMIN_USERNAME/ADMIN_PASSWORD in .env and re-run this script to change credentials.');
  await pool.end();
}

main().catch((err) => {
  console.error('Failed to seed admin user:', err);
  process.exit(1);
});
