import { Router, type RequestHandler } from 'express';
import type { Role } from '../../shared/domain.ts';
import { requireRole } from '../auth/middleware.ts';
import { NotImplementedError } from '../errors.ts';

// Planned endpoints from docs/API.md. Each already has its final auth rule, so the frontend can
// integrate against real 401/403 behaviour now and get 501 until the handler is built in Phase 2.
// Replace a line here with a real route when it is implemented.

const ALL: Role[] = ['Employee', 'Technician', 'Manager'];
const todo: RequestHandler = () => { throw new NotImplementedError(); };

export function plannedRoutes(): Router {
  const r = Router();
  const stub = (method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string, roles: Role[]) => r[method](path, requireRole(...roles), todo);

  // Incidents
  stub('get', '/incidents', ALL);                          // role-scoped queue with filters + paging
  stub('post', '/incidents', ['Employee']);                // create, classify, prioritise
  stub('get', '/incidents/:id', ALL);                      // detail + history (ownership checked)
  stub('patch', '/incidents/:id', ['Employee', 'Manager']);
  stub('post', '/incidents/:id/assignment', ['Manager']);
  stub('post', '/incidents/:id/transitions', ALL);         // allowed action depends on role + state
  stub('post', '/incidents/:id/notes', ALL);
  stub('post', '/incidents/:id/feedback', ['Employee']);
  stub('get', '/incidents/:id/similar', ['Technician', 'Manager']);

  // People and catalogue
  stub('get', '/technicians', ['Manager']);
  stub('get', '/services', ALL);
  stub('get', '/categories', ALL);

  // Notifications
  stub('get', '/notifications', ALL);
  stub('post', '/notifications/:id/read', ALL);

  // Administration (Manager only)
  for (const resource of ['users', 'services', 'categories', 'sla-policies']) {
    stub('get', `/admin/${resource}`, ['Manager']);
    stub('post', `/admin/${resource}`, ['Manager']);
    stub('patch', `/admin/${resource}/:id`, ['Manager']);
  }
  stub('get', '/admin/settings', ['Manager']);
  stub('put', '/admin/settings', ['Manager']);             // assignment strategy, priority policy

  // Reports and audit (Manager only)
  stub('get', '/reports/overview', ['Manager']);
  stub('get', '/reports/workload', ['Manager']);
  stub('get', '/reports/services', ['Manager']);
  stub('get', '/reports/sla', ['Manager']);
  stub('get', '/audit', ['Manager']);

  return r;
}
