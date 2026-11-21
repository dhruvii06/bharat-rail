import type pg from 'pg';
import type { Role } from '../../shared/domain.ts';
import { ConflictError } from '../errors.ts';
import type { NewUser, UserRecord, UserRepository } from './types.ts';

// Users live in the shared PostgreSQL `users` table (schema in java/persistence), so the Node API
// and the Java incident service agree on who everyone is. Database roles map to the app's roles.

const toRole: Record<string, Role> = { EMPLOYEE: 'Employee', TECHNICIAN: 'Technician', ADMIN: 'Manager' };
const fromRole: Record<Role, string> = { Employee: 'EMPLOYEE', Technician: 'TECHNICIAN', Manager: 'ADMIN' };

interface UserRow { user_id: number; full_name: string; email: string; password_hash: string; role: string }

function toRecord(row: UserRow): UserRecord {
  return {
    id: String(row.user_id), name: row.full_name, email: row.email, role: toRole[row.role],
    passwordHash: row.password_hash, isTeamLead: false, active: true, createdAt: new Date(0).toISOString()
  };
}

export class PostgresUserRepository implements UserRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) { this.pool = pool; }

  async findById(id: string) {
    if (!/^\d+$/.test(id)) return undefined;
    const r = await this.pool.query<UserRow>('SELECT user_id, full_name, email, password_hash, role FROM users WHERE user_id = $1', [Number(id)]);
    return r.rows[0] ? toRecord(r.rows[0]) : undefined;
  }

  async findByEmail(email: string) {
    const r = await this.pool.query<UserRow>('SELECT user_id, full_name, email, password_hash, role FROM users WHERE lower(email) = lower($1)', [email]);
    return r.rows[0] ? toRecord(r.rows[0]) : undefined;
  }

  async create(user: NewUser) {
    try {
      const r = await this.pool.query<UserRow>(
        'INSERT INTO users (full_name, email, password_hash, role, department) VALUES ($1, lower($2), $3, $4, $5) RETURNING user_id, full_name, email, password_hash, role',
        [user.name, user.email, user.passwordHash, fromRole[user.role], 'Self-registered']);
      return toRecord(r.rows[0]);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ConflictError('An account with this email already exists.');
      throw e;
    }
  }
}
