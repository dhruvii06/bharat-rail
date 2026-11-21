import { createApp } from './app.ts';
import { InMemorySessionRepository, InMemoryUserRepository } from './repositories/memory.ts';
import { seedDemoUsers } from './seed/demoUsers.ts';

// Composition root: picks concrete implementations and starts the server.
// Phase 2: Student 4 replaces the in-memory repositories with the SQLite ones here.

const port = Number(process.env.PORT || 3001);
const users = new InMemoryUserRepository();
const sessions = new InMemorySessionRepository();

const emails = await seedDemoUsers(users);
const app = createApp({ users, sessions });

setInterval(() => void sessions.deleteExpired(new Date()), 10 * 60 * 1000).unref();

app.listen(port, '127.0.0.1', () => {
  console.log(`I-ITSM API on http://127.0.0.1:${port}/api/v1 (in-memory storage)`);
  console.log(`Demo accounts: ${emails.join(', ')}. Password: see backend/seed/demoUsers.ts or DEMO_PASSWORD.`);
});
