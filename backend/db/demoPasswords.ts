import type pg from 'pg';
import { hashPassword } from '../auth/passwords.ts';
import { DEFAULT_DEMO_PASSWORD } from '../seed/demoUsers.ts';

// Development only: seeded accounts in seed.sql / integration.sql have placeholder password hashes
// that nobody can log in with. Give each of them the demo password (DEMO_PASSWORD or the default),
// hashed with scrypt. Accounts that already have a real hash are left alone.
export async function setDemoPasswords(pool: pg.Pool, password = process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD): Promise<string[]> {
  const r = await pool.query<{ user_id: number; email: string }>("SELECT user_id, email FROM users WHERE password_hash NOT LIKE 'scrypt$%'");
  for (const row of r.rows) {
    await pool.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [await hashPassword(password), row.user_id]);
  }
  return r.rows.map(row => row.email);
}
