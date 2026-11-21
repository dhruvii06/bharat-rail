import { Router, type RequestHandler } from 'express';
import type { Role } from '../../shared/domain.ts';
import { requireRole } from '../auth/middleware.ts';
import { NotImplementedError } from '../errors.ts';

// Endpoints from docs/API.md that are not built yet. Each already has its final role rule, so
// clients get real 401/403 behaviour now and 501 until a handler exists.

const todo: RequestHandler = () => { throw new NotImplementedError(); };

export function plannedRoutes(): Router {
  const r = Router();
  const stub = (method: 'get' | 'post' | 'patch' | 'put', path: string, roles: Role[]) => r[method](path, requireRole(...roles), todo);

  stub('patch', '/incidents/:id', ['Employee', 'Manager']);   // edit title/description

  // Administration (Manager only): catalogue and policy editing
  for (const resource of ['users', 'services', 'categories', 'sla-policies']) {
    stub('get', `/admin/${resource}`, ['Manager']);
    stub('post', `/admin/${resource}`, ['Manager']);
    stub('patch', `/admin/${resource}/:id`, ['Manager']);
  }
  stub('get', '/audit', ['Manager']);
  return r;
}
