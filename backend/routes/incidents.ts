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
  route('patch', '/incidents/:id', [...REPORTERS, 'Manager']);  // {title?, description?, category? (manager)}: correct the report
  route('post', '/incidents/:id/assignment', ['Manager']);      // {strategy: skill|load} or {technicianId}
  route('post', '/incidents/:id/priority', ['Manager']);        // {priority: P1-P4, reason}: IT manager override
  route('post', '/incidents/:id/transitions', ALL);             // {action: ACKNOWLEDGE|START|RESOLVE|VERIFY|CLOSE}
  route('post', '/incidents/:id/notes', ALL);                   // {text}: internal staff note (customers get 403 from the service)
  route('post', '/incidents/:id/messages', ALL);                // {text}: conversation between the reporter and the IT team
  route('post', '/incidents/:id/feedback', REPORTERS);          // {rating: 1-5}
  route('get', '/incidents/:id/similar', ['Technician', 'Manager']);
  route('post', '/incidents/:id/info-request', ['Technician']);  // {question}: assigned technician asks the reporter
  route('post', '/incidents/:id/info-response', REPORTERS);   // {answer}: the reporter replies
  // Technicians sharing work (the Java domain checks who may do what):
  route('get', '/incidents/:id/colleagues', ['Technician']);          // who the assignee can hand over to
  route('post', '/incidents/:id/handover', ['Technician']);           // {technicianId?, reason}: ask a colleague, or hand back to the manager when no technicianId
  route('post', '/incidents/:id/handover/accept', ['Technician']);    // the colleague who was asked
  route('post', '/incidents/:id/handover/decline', ['Technician']);   // {reason?}
  route('post', '/incidents/:id/handover/withdraw', ['Technician']);  // the requester, before an answer
  route('post', '/incidents/:id/handoff', ['Technician']);            // {team | technicianId, workDone}: pass part-done work to another team

  route('get', '/services', ALL);
  route('get', '/categories', ALL);
  route('get', '/assignment-strategies', ['Manager']);
  route('get', '/technicians', ['Manager']);
  route('get', '/technicians/me', ['Technician']);              // own workload: active incidents, capacity, availability

  route('get', '/notifications', ALL);
  route('get', '/notifications/outbox', ['Manager']);           // simulated email channel
  route('post', '/notifications/read-all', ALL);
  route('post', '/notifications/:id/read', ALL);

  route('get', '/reports/overview', ['Manager']);
  route('get', '/audit', ['Manager']);                          // audit trail of all incidents: q, action, incidentId, userId, from, to, limit

  // Administration (Manager only). User accounts are handled in routes/adminUsers.ts.
  route('get', '/admin/services', ['Manager']);
  route('post', '/admin/services', ['Manager']);                // {name, category, criticality, tatkalBookingPath?}
  route('patch', '/admin/services/:id', ['Manager']);
  route('get', '/admin/sla-policies', ['Manager']);
  route('put', '/admin/sla-policies/:id', ['Manager']);         // :id = P1..P4, {responseMinutes, resolutionMinutes}
  route('get', '/admin/categories', ['Manager']);
  route('post', '/admin/categories', ['Manager']);              // {label, team}: new category handled by a technician team
  route('patch', '/admin/categories/:id', ['Manager']);         // {label?, active?, team?}
  route('get', '/admin/settings', ['Manager']);
  route('put', '/admin/settings', ['Manager']);                 // {defaultAssignmentStrategy}
  route('put', '/admin/technicians/:id', ['Manager']);          // {skill?, experienceYears?, available?}
  return r;
}
