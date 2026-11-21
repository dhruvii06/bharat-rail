import type pg from 'pg';
import type { Role } from '../../shared/domain.ts';
import { ConflictError } from '../errors.ts';
import type { NewUser, UserDirectory, UserPatch, UserRecord, UserRepository } from './types.ts';

// Users live in the shared PostgreSQL `users` table (schema in java/persistence), so the Node API
// and the Java incident service agree on who everyone is. Database roles map to the app's roles.

const toRole: Record<string, Role> = { EMPLOYEE: 'Employee', TECHNICIAN: 'Technician', ADMIN: 'Manager', PASSENGER: 'Passenger' };
const fromRole: Record<Role, string> = { Employee: 'EMPLOYEE', Technician: 'TECHNICIAN', Manager: 'ADMIN', Passenger: 'PASSENGER' };

interface UserRow { user_id: number; full_name: string; email: string; password_hash: string; role: string; department: string | null; active: boolean; must_change_password: boolean }
const COLUMNS = 'user_id, full_name, email, password_hash, role, department, active, must_change_password';

function toRecord(row: UserRow): UserRecord {
  return {
    id: String(row.user_id), name: row.full_name, email: row.email, role: toRole[row.role],
    passwordHash: row.password_hash, isTeamLead: false, active: row.active, department: row.department, mustChangePassword: row.must_change_password, createdAt: new Date(0).toISOString()
  };
}

export class PostgresUserRepository implements UserRepository, UserDirectory {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) { this.pool = pool; }

  async findById(id: string) {
    if (!/^\d+$/.test(id)) return undefined;
    const r = await this.pool.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE user_id = $1`, [Number(id)]);
    return r.rows[0] ? toRecord(r.rows[0]) : undefined;
  }

  async findByEmail(email: string) {
    const r = await this.pool.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE lower(email) = lower($1)`, [email]);
    return r.rows[0] ? toRecord(r.rows[0]) : undefined;
  }

  async create(user: NewUser) {
    try {
      const r = await this.pool.query<UserRow>(
        `INSERT INTO users (full_name, email, password_hash, role, department, active, must_change_password) VALUES ($1, lower($2), $3, $4, $5, $6, $7) RETURNING ${COLUMNS}`,
        [user.name, user.email, user.passwordHash, fromRole[user.role], user.department ?? 'Self-registered', user.active, user.mustChangePassword ?? false]);
      return toRecord(r.rows[0]);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ConflictError('An account with this email already exists.');
      throw e;
    }
  }

  async setPassword(id: string, passwordHash: string) {
    if (!/^\d+$/.test(id)) return;
    await this.pool.query('UPDATE users SET password_hash = $2, must_change_password = FALSE WHERE user_id = $1', [Number(id), passwordHash]);
  }

  async list() {
    const r = await this.pool.query<UserRow>(`SELECT ${COLUMNS} FROM users ORDER BY role, full_name`);
    return r.rows.map(toRecord);
  }

  async update(id: string, patch: UserPatch) {
    if (!/^\d+$/.test(id)) return undefined;
    const r = await this.pool.query<UserRow>(
      `UPDATE users SET full_name = COALESCE($2, full_name), department = CASE WHEN $3::boolean THEN $4 ELSE department END,
       active = COALESCE($5, active) WHERE user_id = $1 RETURNING ${COLUMNS}`,
      [Number(id), patch.name ?? null, patch.department !== undefined, patch.department ?? null, patch.active ?? null]);
    return r.rows[0] ? toRecord(r.rows[0]) : undefined;
  }
}
