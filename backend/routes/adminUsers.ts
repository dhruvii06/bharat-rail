import { Router } from 'express';
import type { Role } from '../../shared/domain.ts';
import { toPublicUser } from '../auth/AuthService.ts';
import { authOf, requireRole } from '../auth/middleware.ts';
import { hashPassword } from '../auth/passwords.ts';
import { ConflictError, NotFoundError, ValidationError } from '../errors.ts';
import type { IncidentServiceClient } from '../http/incidentService.ts';
import { BodyValidator } from '../http/validate.ts';
import type { UserDirectory, UserRecord, UserRepository } from '../repositories/types.ts';

// IT manager: user and technician accounts. Node owns accounts because it owns passwords;
// a technician's skill profile lives with the incident data, so it is saved through the Java service.

const ROLES: Role[] = ['Employee', 'Technician', 'Manager'];

function view(u: UserRecord) {
  return { ...toPublicUser(u), department: u.department ?? null, active: u.active };
}

export function adminUserRoutes(users: UserRepository, directory: UserDirectory, service: IncidentServiceClient): Router {
  const r = Router();
  r.use('/admin/users', requireRole('Manager'));

  // GET /admin/users -> all accounts, with department and active flag
  r.get('/admin/users', async (_req, res) => {
    res.json((await directory.list()).map(view));
  });

  // POST /admin/users {name, email, password, role, department?, skill?, experienceYears?} -> 201
  r.post('/admin/users', async (req, res) => {
    const v = new BodyValidator(req.body);
    const name = v.string('name', { min: 2, max: 80 });
    const email = v.email('email');
    const password = v.password('password');
    const department = v.optionalString('department', { max: 50 });
    const role = req.body?.role as Role;
    if (!ROLES.includes(role)) throw new ValidationError({ role: 'Choose Employee, Technician or Manager.' });
    const skill = role === 'Technician' ? v.string('skill', { max: 30 }) : undefined;
    v.done();

    const created = await users.create({ name, email, role, department: department ?? null, passwordHash: await hashPassword(password), isTeamLead: false, active: true });
    let warning: string | undefined;
    if (role === 'Technician') {
      const { user } = authOf(res);
      const profile = await service.forward('PUT', `/admin/technicians/${encodeURIComponent(created.id)}`, { id: user.id, role: user.role },
        { skill, experienceYears: req.body?.experienceYears ?? 1, available: true }).catch((e: Error) => ({ status: 503, body: { error: { message: e.message } } }));
      if (profile.status >= 300) warning = `Account created, but the technician profile was not saved: ${(profile.body as { error?: { message?: string } })?.error?.message ?? 'unknown error'}. Set it on the Technicians tab.`;
    }
    res.status(201).json({ user: view(created), ...(warning ? { warning } : {}) });
  });

  // PATCH /admin/users/:id {name?, department?, active?}
  r.patch('/admin/users/:id', async (req, res) => {
    const v = new BodyValidator(req.body);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = 'name' in body ? v.string('name', { min: 2, max: 80 }) : undefined;
    const department = 'department' in body ? v.optionalString('department', { max: 50 }) ?? null : undefined;
    const active = 'active' in body ? v.boolean('active') : undefined;
    v.done();
    if (active === false && req.params.id === authOf(res).user.id) throw new ConflictError('You cannot deactivate your own account.');
    const updated = await directory.update(req.params.id, { name, department, active });
    if (!updated) throw new NotFoundError('User not found.');
    res.json({ user: view(updated) });
  });

  return r;
}
