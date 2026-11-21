import pg from 'pg';

// One connection pool for the PostgreSQL database shared with the Java incident service.
// Same environment variables as the Java side: ITSM_DB_PASSWORD (required), ITSM_DB_HOST,
// ITSM_DB_PORT, ITSM_DB_NAME, ITSM_DB_USER.
export function createPool(env: NodeJS.ProcessEnv = process.env): pg.Pool {
  const password = env.ITSM_DB_PASSWORD;
  if (!password) throw new Error('Set ITSM_DB_PASSWORD so the API can reach the database.');
  return new pg.Pool({
    host: env.ITSM_DB_HOST || 'localhost',
    port: Number(env.ITSM_DB_PORT || 5432),
    database: env.ITSM_DB_NAME || 'irctc_itsm',
    user: env.ITSM_DB_USER || 'itsm_user',
    password,
    max: 5
  });
}
