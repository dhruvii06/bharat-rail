// Loads the schema, seed data and integration migration into an EMPTY database.
// Use this when PostgreSQL is installed locally (Docker's compose file does the same on first start).
// Usage: npm run db:setup
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

if (existsSync('.env')) process.loadEnvFile('.env');
const env = process.env;
if (!env.ITSM_DB_PASSWORD) { console.error('Set ITSM_DB_PASSWORD in .env (see .env.example).'); process.exit(1); }

const client = new pg.Client({
  host: env.ITSM_DB_HOST || 'localhost', port: Number(env.ITSM_DB_PORT || 5432),
  database: env.ITSM_DB_NAME || 'irctc_itsm', user: env.ITSM_DB_USER || 'itsm_user', password: env.ITSM_DB_PASSWORD
});
await client.connect();
try {
  const exists = await client.query("SELECT to_regclass('public.incidents') AS t");
  if (exists.rows[0].t) {
    console.log('Tables already exist. Applying only the re-runnable integration migration.');
  } else {
    for (const file of ['schema.sql', 'seed.sql']) {
      await client.query(readFileSync(`java/persistence/src/main/resources/${file}`, 'utf8'));
      console.log(`Loaded ${file}`);
    }
  }
  await client.query(readFileSync('java/persistence/src/main/resources/integration.sql', 'utf8'));
  console.log('Loaded integration.sql');
} finally {
  await client.end();
}
