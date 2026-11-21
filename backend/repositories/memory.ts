import { randomUUID } from 'node:crypto';
import { ConflictError } from '../errors.ts';
import type { NewUser, SessionRecord, SessionRepository, UserRecord, UserRepository } from './types.ts';

// In-memory repositories for Phase 1 and for API tests. Data is lost on restart.

export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, UserRecord>();
  private readonly idByEmail = new Map<string, string>();

  async findById(id: string) { return this.byId.get(id); }

  async findByEmail(email: string) {
    const id = this.idByEmail.get(email.toLowerCase());
    return id ? this.byId.get(id) : undefined;
  }

  async create(user: NewUser) {
    const email = user.email.toLowerCase();
    if (this.idByEmail.has(email)) throw new ConflictError('An account with this email already exists.');
    const record: UserRecord = { ...user, email, id: user.id ?? `usr-${randomUUID()}`, createdAt: new Date().toISOString() };
    this.byId.set(record.id, record);
    this.idByEmail.set(email, record.id);
    return record;
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, SessionRecord>();

  async create(session: SessionRecord) { this.sessions.set(session.tokenHash, session); }
  async findByTokenHash(tokenHash: string) { return this.sessions.get(tokenHash); }
  async delete(tokenHash: string) { this.sessions.delete(tokenHash); }

  async deleteExpired(now: Date) {
    let removed = 0;
    for (const [key, s] of this.sessions) {
      if (Date.parse(s.expiresAt) <= now.getTime()) { this.sessions.delete(key); removed++; }
    }
    return removed;
  }
}
