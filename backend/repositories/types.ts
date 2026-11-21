import type { Role } from '../../shared/domain.ts';

// Repository contracts (Repository pattern). The API depends only on these interfaces.
// Phase 1 ships in-memory versions (./memory.ts); Student 4 adds SQLite versions in backend/db/
// and swaps them in at backend/server.ts without touching routes or services.

export interface UserRecord {
  id: string;
  name: string;
  email: string;            // stored lower-case, unique
  role: Role;
  passwordHash: string;     // see backend/auth/passwords.ts, never sent to clients
  isTeamLead: boolean;      // technicians only; used by escalation in Phase 3
  active: boolean;          // deactivated accounts cannot sign in
  department?: string | null;
  mustChangePassword?: boolean;   // set on accounts the IT manager creates with a temporary password
  createdAt: string;        // ISO 8601 UTC
}

/** `id` is optional so seed data can use stable ids such as `tech-app`. */
export type NewUser = Omit<UserRecord, 'id' | 'createdAt'> & { id?: string };

export interface UserRepository {
  findById(id: string): Promise<UserRecord | undefined>;
  findByEmail(email: string): Promise<UserRecord | undefined>;
  /** Throws ConflictError when the email is already registered. */
  create(user: NewUser): Promise<UserRecord>;
  /** Stores a new password hash and clears the must-change flag. */
  setPassword(id: string, passwordHash: string): Promise<void>;
}

export interface UserPatch { name?: string; department?: string | null; active?: boolean }

/** Account administration for the IT manager (list and edit; creation uses UserRepository.create). */
export interface UserDirectory {
  list(): Promise<UserRecord[]>;
  update(id: string, patch: UserPatch): Promise<UserRecord | undefined>;
}

export interface SessionRecord {
  tokenHash: string;        // SHA-256 of the bearer token; the raw token is never stored
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface SessionRepository {
  create(session: SessionRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | undefined>;
  delete(tokenHash: string): Promise<void>;
  deleteExpired(now: Date): Promise<number>;
}
