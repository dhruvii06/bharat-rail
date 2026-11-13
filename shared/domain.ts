export type Role = 'Employee' | 'Technician' | 'Manager';
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type Status = 'CLASSIFIED' | 'ASSIGNED' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'VERIFIED' | 'CLOSED';
export const statuses: Status[] = ['CLASSIFIED', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'CLOSED'];
export const services = ['Ticket booking', 'Tatkal booking', 'Payments', 'PNR', 'Authentication', 'Refunds', 'Notifications', 'E-catering', 'Website'] as const;
export const categories = ['Application', 'Database', 'Network', 'Security', 'Authentication', 'Software'] as const;
export interface IncidentInput {
  title: string; description: string; service: string; category: string;
  impact: number; urgency: number; criticality: number;
}
export interface AuditEvent { at: string; actor: string; action: string }
export interface Incident extends IncidentInput {
  id: string; reporterId: string; priority: Priority; status: Status;
  createdAt: string; responseDueAt: string; resolutionDueAt: string;
  assigneeId?: string; acknowledgedAt?: string; resolvedAt?: string;
  resolution?: string; history: AuditEvent[];
}
export interface Technician { id: string; name: string; skills: string[]; available: boolean }
export const slaMinutes: Record<Priority, { response: number; resolution: number }> = {
  P1: { response: 5, resolution: 30 }, P2: { response: 15, resolution: 120 },
  P3: { response: 60, resolution: 480 }, P4: { response: 240, resolution: 1440 }
};
// Proposed course policy; these values are not official IRCTC policies.
export function calculatePriority(input: Pick<IncidentInput, 'impact' | 'urgency' | 'criticality'>): Priority {
  const factors = [input.impact, input.urgency, input.criticality];
  if (factors.some(n => !Number.isInteger(n) || n < 1 || n > 3)) throw new Error('Priority factors must be integers from 1 to 3.');
  const score = factors.reduce((a, b) => a * b, 1);
  return score >= 18 ? 'P1' : score >= 8 ? 'P2' : score >= 3 ? 'P3' : 'P4';
}
export function nextStatus(incident: Incident, role: Role): Status | undefined {
  if (role === 'Manager' && incident.status === 'CLASSIFIED') return 'ASSIGNED';
  if (role === 'Technician') return ({ ASSIGNED: 'ACKNOWLEDGED', ACKNOWLEDGED: 'IN_PROGRESS', IN_PROGRESS: 'RESOLVED' } as Partial<Record<Status, Status>>)[incident.status];
  if (role === 'Employee' && incident.status === 'RESOLVED') return 'VERIFIED';
  if (role === 'Manager' && incident.status === 'VERIFIED') return 'CLOSED';
}
export function slaBreached(incident: Incident, now = Date.now()): boolean {
  return new Date(incident.acknowledgedAt ?? now).getTime() > Date.parse(incident.responseDueAt)
    || new Date(incident.resolvedAt ?? now).getTime() > Date.parse(incident.resolutionDueAt);
}
