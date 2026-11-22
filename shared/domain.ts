// Shared contract between the React frontend and the API. The Java incident service
// (java/service, Views.java) is the source of truth for incidents; these types mirror its JSON.

export type Role = 'Employee' | 'Technician' | 'Manager' | 'Customer';
/** Roles that report incidents, follow their own, answer questions and verify fixes. */
export const reporterRoles: Role[] = ['Employee', 'Customer'];
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type Status = 'NEW' | 'CLASSIFIED' | 'ASSIGNED' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'VERIFIED' | 'CLOSED';
export type SlaState = 'WITHIN' | 'AT_RISK' | 'BREACHED' | 'MET' | 'NONE';
export type Action = 'ASSIGN' | 'ACKNOWLEDGE' | 'START' | 'REQUEST_INFO' | 'PROVIDE_INFO' | 'RESOLVE' | 'VERIFY' | 'CLOSE' | 'FEEDBACK' | 'NOTE' | 'MESSAGE' | 'CHANGE_PRIORITY';
export type Criticality = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export const criticalities: Criticality[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export const statuses: Status[] = ['NEW', 'CLASSIFIED', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'CLOSED'];
export const priorities: Priority[] = ['P1', 'P2', 'P3', 'P4'];
export const slaStates: SlaState[] = ['WITHIN', 'AT_RISK', 'BREACHED', 'MET'];
export const slaLabel: Record<SlaState, string> = { WITHIN: 'Within target', AT_RISK: 'At risk', BREACHED: 'Breached', MET: 'Met', NONE: '—' };
export const finished: Status[] = ['RESOLVED', 'VERIFIED', 'CLOSED'];

export interface User { id: string; name: string; email: string; role: Role; isTeamLead: boolean; mustChangePassword?: boolean }

export interface IncidentInput {
  title: string; description: string; serviceId: number; category: string;
  impact: number; urgency: number; affectedUsers: number; tatkalWindow: boolean;
}

/** What a customer tells us; the system works out impact, urgency, category and priority from it. */
export type CustomerEffect = 'BLOCKED' | 'DEGRADED' | 'MINOR';
export interface CustomerIncidentInput {
  title: string; description: string; serviceId: number;
  effect: CustomerEffect; moneyTaken: boolean; stillHappening: boolean;
}

export interface HistoryEntry {
  at: string; actorId: number | null; actorName: string; action: string;
  fromStatus: string | null; toStatus: string | null; description: string | null;
}

export interface Resolution {
  summary: string; rootCause: string; resolvedAt: string; technicianId: number | null;
  technicianName: string | null; feedback: number | null;
}

export interface SimilarIncident { id: string; title: string; status: Status; priority: Priority | null }

export interface Incident {
  id: string; title: string; description: string; category: string;
  serviceId: number; serviceName: string; impact: number; urgency: number; criticality: number;
  affectedUsers: number; tatkalWindow: boolean; priority: Priority | null; priorityReason: string | null;
  status: Status; reporterId: number; reporterName: string; assigneeId: number | null; assigneeName: string | null;
  createdAt: string; acknowledgedAt: string | null; responseDueAt: string | null; resolutionDueAt: string | null;
  resolvedAt: string | null; sla: SlaState;
  informationRequest: string | null; informationRequestedAt: string | null;   // open question to the reporter
  // Present on the detail endpoint only:
  resolution: Resolution | null; history: HistoryEntry[] | null; allowedActions: Action[] | null; similar: SimilarIncident[] | null;
}

export interface CreatedIncident { incident: Incident; possibleDuplicates: SimilarIncident[] }

export interface Service { id: number; name: string; category: string; criticality: Criticality; criticalityScore: number }

export interface Category { code: string; label: string; active: boolean }

export interface SlaPolicy { priority: Priority; responseMinutes: number; resolutionMinutes: number }

export interface Settings { defaultAssignmentStrategy: string; assignmentStrategies: string[] }

export interface AdminUser extends User { department: string | null; active: boolean }

export interface NewAccount {
  name: string; email: string; password: string; role: Role; department?: string;
  skill?: string; experienceYears?: number;
}

export interface Technician {
  id: number; name: string; email: string; skill: string; workload: number; capacity: number;
  experienceYears: number; available: boolean;
}

export interface Notification { id: number; incidentId: string | null; type: string; message: string; createdAt: string; read: boolean }

export interface EmailOutboxEntry { id: number; recipientEmail: string; incidentId: string | null; type: string; message: string; createdAt: string }

export interface Count { label: string; count: number }

export interface Overview {
  total: number; open: number; critical: number; resolved: number; slaViolations: number;
  slaCompliancePercent: number | null; averageResolutionMinutes: number | null;
  byService: Count[]; byPriority: Count[]; byStatus: Count[]; workload: Technician[];
}

export interface PriorityFactors {
  impact: number; urgency: number; criticality: number; securityIncident?: boolean; tatkalWindow?: boolean;
}

/**
 * Preview of the priority the server will calculate. Mirrors RailwayPriorityStrategy in
 * java/domain: security incidents and high-impact, high-urgency incidents in the Tatkal window are
 * P1; otherwise impact × urgency × service criticality (each 1–3): ≥20 P1, ≥10 P2, ≥5 P3, else P4.
 * The server's result is the one that counts.
 */
export function calculatePriority(f: PriorityFactors): Priority {
  const factors = [f.impact, f.urgency, f.criticality];
  if (factors.some(n => !Number.isInteger(n) || n < 1 || n > 3)) throw new Error('Priority factors must be integers from 1 to 3.');
  const score = factors.reduce((a, b) => a * b, 1);
  if (f.securityIncident || (f.tatkalWindow && f.impact === 3 && f.urgency === 3) || score >= 20) return 'P1';
  return score >= 10 ? 'P2' : score >= 5 ? 'P3' : 'P4';
}
