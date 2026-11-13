import type { Incident, IncidentInput, Role, Technician } from '../../shared/domain.ts';
import { calculatePriority, categories, nextStatus, services, slaMinutes } from '../../shared/domain.ts';

export interface IncidentApi {
  list(): Promise<Incident[]>;
  create(input: IncidentInput): Promise<Incident>;
  advance(id: string, role: Role, resolution?: string): Promise<Incident>;
  technicians(): Promise<Technician[]>;
}
export const users = { Employee: { id: 'employee-demo', name: 'Demo employee' }, Technician: { id: 'tech-app', name: 'Demo technician' }, Manager: { id: 'manager-demo', name: 'Demo manager' } };
const technicians: Technician[] = [
  { id: 'tech-app', name: 'Demo technician', skills: ['Application', 'Software', 'Authentication'], available: true },
  { id: 'tech-infra', name: 'Infrastructure technician', skills: ['Database', 'Network', 'Security'], available: true }
];
const key = 'oop-irctc.incidents.v1';
function build(input: IncidentInput, id: string): Incident {
  if (input.title.trim().length < 5 || input.title.length > 120 || input.description.trim().length < 10 || input.description.length > 4000) throw new Error('Use a title of 5–120 characters and description of 10–4000 characters.');
  if (!(services as readonly string[]).includes(input.service) || !(categories as readonly string[]).includes(input.category)) throw new Error('Select a valid service and category.');
  const priority = calculatePriority(input); const now = Date.now();
  return { ...input, title: input.title.trim(), description: input.description.trim(), id, reporterId: users.Employee.id, priority, status: 'CLASSIFIED', createdAt: new Date(now).toISOString(), responseDueAt: new Date(now + slaMinutes[priority].response * 60000).toISOString(), resolutionDueAt: new Date(now + slaMinutes[priority].resolution * 60000).toISOString(), history: [{ at: new Date(now).toISOString(), actor: users.Employee.name, action: `Reported and classified; calculated priority ${priority}.` }] };
}
function load(): Incident[] {
  const raw = localStorage.getItem(key);
  if (raw) { try { const data = JSON.parse(raw); if (Array.isArray(data)) return data; } catch { /* Report corruption without silently overwriting stored work. */ } throw new Error('Demo storage is unreadable. Clear this site’s local storage to reset it.'); }
  return [build({ title: 'Payment transactions failing during Tatkal', description: 'Passengers cannot complete payment during the booking window.', service: 'Payments', category: 'Application', impact: 3, urgency: 3, criticality: 3 }, 'INC-DEMO-001')];
}
// Strategy implementations are interchangeable. Server must implement authoritative versions.
export interface AssignmentStrategy { select(incident: Incident, pool: Technician[], incidents: Incident[]): Technician | undefined }
export class SkillBasedAssignment implements AssignmentStrategy {
  select(incident: Incident, pool: Technician[], _incidents: Incident[]) { return pool.find(t => t.available && t.skills.includes(incident.category)); }
}
export class LoadBasedAssignment implements AssignmentStrategy {
  select(_incident: Incident, pool: Technician[], incidents: Incident[]) {
    const count = (id: string) => incidents.filter(i => i.assigneeId === id && !['RESOLVED', 'VERIFIED', 'CLOSED'].includes(i.status)).length;
    return pool.filter(t => t.available).sort((a, b) => count(a.id) - count(b.id) || a.id.localeCompare(b.id))[0];
  }
}
export class MockIncidentApi implements IncidentApi {
  constructor(private assignment: AssignmentStrategy = new SkillBasedAssignment()) {}
  private save(items: Incident[]) { localStorage.setItem(key, JSON.stringify(items)); }
  async list() { const items = load(); this.save(items); return items; }
  async technicians() { return technicians; }
  async create(input: IncidentInput) {
    const items = load(); const incident = build(input, `INC-${crypto.randomUUID()}`);
    this.save([incident, ...items]); return incident;
  }
  async advance(id: string, role: Role, resolution?: string) {
    const items = load(); const incident = items.find(i => i.id === id);
    if (!incident) throw new Error('Incident not found.');
    const status = nextStatus(incident, role);
    if (!status) throw new Error('This role cannot perform that transition.');
    if (role === 'Technician' && incident.assigneeId !== users.Technician.id) throw new Error('This incident is assigned to another technician.');
    if (role === 'Employee' && incident.reporterId !== users.Employee.id) throw new Error('Only the reporter can verify resolution.');
    if (status === 'ASSIGNED') {
      const technician = this.assignment.select(incident, technicians, items);
      if (!technician) throw new Error('No suitable technician is available.');
      incident.assigneeId = technician.id;
    }
    if (status === 'RESOLVED' && (!resolution || resolution.trim().length < 10 || resolution.length > 4000)) throw new Error('Provide resolution details of 10–4000 characters.');
    const at = new Date().toISOString();
    if (status === 'ACKNOWLEDGED') incident.acknowledgedAt = at;
    if (status === 'RESOLVED') { incident.resolution = resolution!.trim(); incident.resolvedAt = at; }
    incident.history.push({ at, actor: users[role].name, action: `${incident.status} → ${status}${status === 'ASSIGNED' ? ` (${incident.assigneeId})` : ''}` });
    incident.status = status; this.save(items); return incident;
  }
}
export const api: IncidentApi = new MockIncidentApi();
