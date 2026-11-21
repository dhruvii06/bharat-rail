import { createApp } from './app.ts';
import { createPool } from './db/pool.ts';
import { setDemoPasswords } from './db/demoPasswords.ts';
import { InMemorySessionRepository, InMemoryUserRepository } from './repositories/memory.ts';
import { PostgresUserRepository } from './repositories/postgres.ts';
import type { UserRepository } from './repositories/types.ts';
import { seedDemoUsers } from './seed/demoUsers.ts';

// Composition root: picks concrete implementations and starts the server.
// With ITSM_DB_PASSWORD set, users come from the shared PostgreSQL database (the full connected app).
// Without it, the API runs on in-memory demo users only (login works, incidents need the Java service).

const port = Number(process.env.PORT || 3001);
const sessions = new InMemorySessionRepository();
let users: UserRepository;

if (process.env.ITSM_DB_PASSWORD) {
  const pool = createPool();
  users = new PostgresUserRepository(pool);
  if (process.env.NODE_ENV !== 'production') {
    const updated = await setDemoPasswords(pool);
    if (updated.length) console.log(`Set the demo password on ${updated.length} seeded account(s): ${updated.join(', ')}`);
  }
  console.log('Users: PostgreSQL');
} else {
  const memory = new InMemoryUserRepository();
  await seedDemoUsers(memory);
  users = memory;
  console.log('Users: in-memory demo accounts (set ITSM_DB_PASSWORD to use the shared database)');
}

const app = createApp({ users, sessions });
setInterval(() => void sessions.deleteExpired(new Date()), 10 * 60 * 1000).unref();

app.listen(port, '127.0.0.1', () => {
  console.log(`I-ITSM API on http://127.0.0.1:${port}/api/v1 → incident service ${process.env.ITSM_SERVICE_URL || 'http://127.0.0.1:8081'}`);
});
