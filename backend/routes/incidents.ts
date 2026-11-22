import { Router } from 'express';
import type { Role } from '../../shared/domain.ts';
import { requireRole } from '../auth/middleware.ts';
import type { IncidentServiceClient } from '../http/incidentService.ts';

// Incident endpoints. Node checks the role first (cheap, clear 403s); the Java service then applies
// the domain rules (lifecycle, ownership, capacity) and stores the result. See docs/API.md.

const ALL: Role[] = ['Employee', 'Technician', 'Manager', 'Customer'];
const REPORTERS: Role[] = ['Employee', 'Customer'];

export function incidentRoutes(service: IncidentServiceClient): Router {
  const r = Router();
  const forward = service.proxy();
  const route = (method: 'get' | 'post' | 'put' | 'patch', path: string, roles: Role[]) => r[method](path, requireRole(...roles), forward);

  route('get', '/incidents', ALL);                              // role-scoped queue, filters as query string
  route('post', '/incidents', REPORTERS);                      // report: classify, prioritise, find duplicates
  route('get', '/incidents/:id', ALL);                          // detail, history, allowed actions
  route('post', '/incidents/:id/assignment', ['Manager']);      // {strategy: skill|load} or {technicianId}
  route('post', '/incidents/:id/priority', ['Manager']);        // {priority: P1-P4, reason}: IT manager override
  route('post', '/incidents/:id/transitions', ALL);             // {action: ACKNOWLEDGE|START|RESOLVE|VERIFY|CLOSE}
  route('post', '/incidents/:id/notes', ALL);                   // {text}: internal staff note (customers get 403 from the service)
  route('post', '/incidents/:id/messages', ALL);                // {text}: conversation between the reporter and the IT team
  route('post', '/incidents/:id/feedback', REPORTERS);          // {rating: 1-5}
  route('get', '/incidents/:id/similar', ['Technician', 'Manager']);
  route('post', '/incidents/:id/info-request', ['Technician']);  // {question}: assigned technician asks the reporter
  route('post', '/incidents/:id/info-response', REPORTERS);   // {answer}: the reporter replies

  route('get', '/services', ALL);
  route('get', '/categories', ALL);
  route('get', '/assignment-strategies', ['Manager']);
  route('get', '/technicians', ['Manager']);

  route('get', '/notifications', ALL);
  route('get', '/notifications/outbox', ['Manager']);           // simulated email channel
  route('post', '/notifications/read-all', ALL);
  route('post', '/notifications/:id/read', ALL);

  route('get', '/reports/overview', ['Manager']);

  // Administration (Manager only). User accounts are handled in routes/adminUsers.ts.
  route('get', '/admin/services', ['Manager']);
  route('post', '/admin/services', ['Manager']);                // {name, category, criticality}
  route('patch', '/admin/services/:id', ['Manager']);
  route('get', '/admin/sla-policies', ['Manager']);
  route('put', '/admin/sla-policies/:id', ['Manager']);         // :id = P1..P4, {responseMinutes, resolutionMinutes}
  route('get', '/admin/categories', ['Manager']);
  route('patch', '/admin/categories/:id', ['Manager']);         // {label?, active?}
  route('get', '/admin/settings', ['Manager']);
  route('put', '/admin/settings', ['Manager']);                 // {defaultAssignmentStrategy}
  route('put', '/admin/technicians/:id', ['Manager']);          // {skill?, experienceYears?, available?}
  return r;
}
