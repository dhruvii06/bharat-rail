import { createHash, randomBytes } from 'node:crypto';
import type { Role } from '../../shared/domain.ts';
import { InvalidCredentialsError, TooManyRequestsError, UnauthenticatedError, ValidationError } from '../errors.ts';
import type { SessionRepository, UserRecord, UserRepository } from '../repositories/types.ts';
import { burnPasswordCheck, hashPassword, verifyPassword } from './passwords.ts';

/** What the API returns about a user. Never includes the password hash. */
export interface PublicUser { id: string; name: string; email: string; role: Role; isTeamLead: boolean; mustChangePassword: boolean }

export interface AuthContext { user: PublicUser; tokenHash: string }

export interface LoginResult { token: string; expiresAt: string; user: PublicUser }

export interface AuthOptions {
  sessionTtlMs?: number;          // default 8 hours (one working shift)
  maxFailedLogins?: number;       // default 5
  lockoutMs?: number;             // default 15 minutes
  now?: () => Date;               // injectable clock for tests
}

export function toPublicUser(u: UserRecord): PublicUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role, isTeamLead: u.isTeamLead, mustChangePassword: u.mustChangePassword ?? false };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Authentication use cases. Depends only on repository interfaces, so it works the same
// with in-memory storage (tests) and SQLite (Student 4).
export class AuthService {
  private readonly users: UserRepository;
  private readonly sessions: SessionRepository;
  private readonly ttlMs: number;
  private readonly maxFailed: number;
  private readonly lockoutMs: number;
  private readonly now: () => Date;
  private readonly failures = new Map<string, { count: number; firstAt: number }>();

  constructor(users: UserRepository, sessions: SessionRepository, opts: AuthOptions = {}) {
    this.users = users;
    this.sessions = sessions;
    this.ttlMs = opts.sessionTtlMs ?? 8 * 60 * 60 * 1000;
    this.maxFailed = opts.maxFailedLogins ?? 5;
    this.lockoutMs = opts.lockoutMs ?? 15 * 60 * 1000;
    this.now = opts.now ?? (() => new Date());
  }

  /**
   * Self-registration is for members of the public, who become Customers. Employee, technician and
   * manager accounts are created by the IT manager (routes/adminUsers.ts).
   */
  async register(input: { name: string; email: string; password: string }): Promise<PublicUser> {
    const user = await this.users.create({
      name: input.name, email: input.email, role: 'Customer', department: 'Customer',
      passwordHash: await hashPassword(input.password), isTeamLead: false, active: true
    });
    return toPublicUser(user);
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const key = email.toLowerCase();
    this.assertNotLocked(key);
    const user = await this.users.findByEmail(key);
    const ok = user ? user.active && await verifyPassword(password, user.passwordHash) : (await burnPasswordCheck(password), false);
    if (!ok || !user) {
      this.recordFailure(key);
      throw new InvalidCredentialsError();
    }
    this.failures.delete(key);

    const token = randomBytes(32).toString('base64url');
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + this.ttlMs);
    await this.sessions.create({ tokenHash: hashToken(token), userId: user.id, createdAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString() });
    return { token, expiresAt: expiresAt.toISOString(), user: toPublicUser(user) };
  }

  /** Resolves a bearer token to the signed-in user, or throws 401. */
  async authenticate(token: string | undefined): Promise<AuthContext> {
    if (!token) throw new UnauthenticatedError();
    const tokenHash = hashToken(token);
    const session = await this.sessions.findByTokenHash(tokenHash);
    if (!session) throw new UnauthenticatedError('Your session is not valid. Sign in again.');
    if (Date.parse(session.expiresAt) <= this.now().getTime()) {
      await this.sessions.delete(tokenHash);
      throw new UnauthenticatedError('Your session has expired. Sign in again.');
    }
    const user = await this.users.findById(session.userId);
    if (!user || !user.active) {
      await this.sessions.delete(tokenHash);
      throw new UnauthenticatedError('This account is no longer active.');
    }
    return { user: toPublicUser(user), tokenHash };
  }

  /** Changes the signed-in user's password after checking the current one; clears the must-change flag. */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user || !user.active) throw new UnauthenticatedError();
    if (!(await verifyPassword(currentPassword, user.passwordHash))) throw new ValidationError({ currentPassword: 'This is not your current password.' });
    if (currentPassword === newPassword) throw new ValidationError({ newPassword: 'Choose a password different from the current one.' });
    await this.users.setPassword(userId, await hashPassword(newPassword));
    return toPublicUser({ ...user, mustChangePassword: false });
  }

  async logout(tokenHash: string): Promise<void> {
    await this.sessions.delete(tokenHash);
  }

  private assertNotLocked(key: string) {
    const f = this.failures.get(key);
    if (!f) return;
    if (this.now().getTime() - f.firstAt > this.lockoutMs) { this.failures.delete(key); return; }
    if (f.count >= this.maxFailed) throw new TooManyRequestsError('Too many failed sign-in attempts. Wait 15 minutes and try again.');
  }

  private recordFailure(key: string) {
    const now = this.now().getTime();
    const f = this.failures.get(key);
    if (!f || now - f.firstAt > this.lockoutMs) this.failures.set(key, { count: 1, firstAt: now });
    else f.count++;
  }
}
