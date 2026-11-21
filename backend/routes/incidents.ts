import { Router } from 'express';
import type { Role } from '../../shared/domain.ts';
import { requireRole } from '../auth/middleware.ts';
import type { IncidentServiceClient } from '../http/incidentService.ts';

// Incident endpoints. Node checks the role first (cheap, clear 403s); the Java service then applies
// the domain rules (lifecycle, ownership, capacity) and stores the result. See docs/API.md.

const ALL: Role[] = ['Employee', 'Technician', 'Manager'];

export function incidentRoutes(service: IncidentServiceClient): Router {
  const r = Router();
  const forward = service.proxy();
  const route = (method: 'get' | 'post', path: string, roles: Role[]) => r[method](path, requireRole(...roles), forward);

  route('get', '/incidents', ALL);                              // role-scoped queue, filters as query string
  route('post', '/incidents', ['Employee']);                    // report: classify, prioritise, find duplicates
  route('get', '/incidents/:id', ALL);                          // detail, history, allowed actions
  route('post', '/incidents/:id/assignment', ['Manager']);      // {strategy: skill|load} or {technicianId}
  route('post', '/incidents/:id/transitions', ALL);             // {action: ACKNOWLEDGE|START|RESOLVE|VERIFY|CLOSE}
  route('post', '/incidents/:id/notes', ALL);                   // {text}
  route('post', '/incidents/:id/feedback', ['Employee']);       // {rating: 1-5}
  route('get', '/incidents/:id/similar', ['Technician', 'Manager']);

  route('get', '/services', ALL);
  route('get', '/categories', ALL);
  route('get', '/assignment-strategies', ['Manager']);
  route('get', '/technicians', ['Manager']);

  route('get', '/notifications', ALL);
  route('get', '/notifications/outbox', ['Manager']);           // simulated email channel
  route('post', '/notifications/read-all', ALL);
  route('post', '/notifications/:id/read', ALL);

  route('get', '/reports/overview', ['Manager']);
  return r;
}
