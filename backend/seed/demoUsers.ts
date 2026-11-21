import type { Role } from '../../shared/domain.ts';
import { hashPassword } from '../auth/passwords.ts';
import type { UserRepository } from '../repositories/types.ts';

// Demo accounts for local development and the recorded demo. Not real people or real credentials.
// All accounts share one password: DEMO_PASSWORD from .env, or the default below.
// Ids match the ones the frontend mock already uses (employee-demo, tech-app, tech-infra, manager-demo).
export const DEFAULT_DEMO_PASSWORD = 'Incident@2026';

const accounts: { id: string; name: string; email: string; role: Role; isTeamLead?: boolean }[] = [
  { id: 'employee-demo', name: 'Customer Care Desk', email: 'employee@demo.local', role: 'Employee' },
  { id: 'employee-ops', name: 'Station Operations', email: 'ops@demo.local', role: 'Employee' },
  { id: 'tech-app', name: 'Application Support', email: 'tech.app@demo.local', role: 'Technician' },
  { id: 'tech-infra', name: 'Infrastructure Support', email: 'tech.infra@demo.local', role: 'Technician' },
  { id: 'tech-payments', name: 'Payments Support', email: 'tech.payments@demo.local', role: 'Technician' },
  { id: 'lead-demo', name: 'Support Team Lead', email: 'lead@demo.local', role: 'Technician', isTeamLead: true },
  { id: 'manager-demo', name: 'IT Manager', email: 'manager@demo.local', role: 'Manager' }
];

export async function seedDemoUsers(users: UserRepository, password = process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD) {
  const passwordHash = await hashPassword(password);
  for (const a of accounts) {
    if (await users.findByEmail(a.email)) continue;
    await users.create({ ...a, isTeamLead: a.isTeamLead ?? false, passwordHash, active: true });
  }
  return accounts.map(a => a.email);
}
