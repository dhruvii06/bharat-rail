import type {
  Action, AdminUser, AuditSearchEntry, Category, Colleague, CreatedIncident, CustomerIncidentInput, Criticality, EmailOutboxEntry, Incident, IncidentInput, NewAccount, Notification,
  Overview, Service, Settings, SlaPolicy, Technician, User
} from '../../shared/domain.ts';

// HTTP client for the Node API (/api/v1). The Vite dev server forwards /api to the API on port 3001.

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/v1';
const TOKEN_KEY = 'bharat-rail.session';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;
  constructor(status: number, code: string, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.status = status; this.code = code; this.fieldErrors = fieldErrors;
  }
}

function readToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function writeToken(value: string | null) {
  try { if (value) sessionStorage.setItem(TOKEN_KEY, value); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable: session lasts until reload */ }
}

let token: string | null = readToken();
let onUnauthorized: () => void = () => {};

/** Called when the server says the session is no longer valid (expired, revoked). */
export function setUnauthorizedHandler(handler: () => void) { onUnauthorized = handler; }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check that it is running, then try again.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => undefined) as { error?: { code: string; message: string; fieldErrors?: Record<string, string> } } | undefined;
  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith('/auth/login')) { token = null; writeToken(null); onUnauthorized(); }
    throw new ApiError(res.status, data?.error?.code ?? 'ERROR', data?.error?.message ?? `Request failed (${res.status}).`, data?.error?.fieldErrors);
  }
  return data as T;
}

function query(params: Record<string, string | undefined>) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return q ? `?${q}` : '';
}

export interface IncidentFilters {
  q?: string; status?: string; priority?: string; serviceId?: string; category?: string;
  sla?: string; technicianId?: string; from?: string; to?: string;
}

export const api = {
  hasSession: () => token !== null,

  async login(email: string, password: string): Promise<User> {
    const r = await request<{ token: string; user: User }>('POST', '/auth/login', { email, password });
    token = r.token; writeToken(r.token);
    return r.user;
  },
  async logout() {
    try { await request('POST', '/auth/logout'); } finally { token = null; writeToken(null); }
  },
  me: async () => (await request<{ user: User }>('GET', '/auth/me')).user,
  changePassword: async (currentPassword: string, newPassword: string) =>
    (await request<{ user: User }>('POST', '/auth/change-password', { currentPassword, newPassword })).user,
  register: async (name: string, email: string, password: string) =>
    (await request<{ user: User }>('POST', '/auth/register', { name, email, password })).user,

  incidents: (filters: IncidentFilters = {}) => request<Incident[]>('GET', `/incidents${query({ ...filters })}`),
  incident: (id: string) => request<Incident>('GET', `/incidents/${encodeURIComponent(id)}`),
  report: (input: IncidentInput | CustomerIncidentInput) => request<CreatedIncident>('POST', '/incidents', input),
  assign: (id: string, choice: { strategy?: string; technicianId?: number }) => request<Incident>('POST', `/incidents/${encodeURIComponent(id)}/assignment`, choice),
  transition: (id: string, action: 'ACKNOWLEDGE' | 'START' | 'RESOLVE' | 'VERIFY' | 'CLOSE', details: { summary?: string; rootCause?: string } = {}) =>
    request<Incident>('POST', `/incidents/${encodeURIComponent(id)}/transitions`, { action, ...details }),
  note: (id: string, text: string) => request<Incident>('POST', `/incidents/${encodeURIComponent(id)}/notes`, { text }),
  changePriority: (id: string, priority: string, reason: string) =>
    request<Incident>('POST', `/incidents/${encodeURIComponent(id)}/priority`, { priority, reason }),
  edit: (id: string, patch: { title?: string; description?: string; category?: string }) =>
    request<Incident>('PATCH', `/incidents/${encodeURIComponent(id)}`, patch),
  audit: (filters: Record<string, string>) =>
    request<AuditSearchEntry[]>('GET', `/audit?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== ''))}`),
  colleagues: (id: string) => request<Colleague[]>('GET', `/incidents/${encodeURIComponent(id)}/colleagues`),
  /** Ask a colleague to take over; with no technicianId the incident goes back to the IT manager. */
  handover: (id: string, technicianId: number | null, reason: string) =>
    request<Incident>('POST', `/incidents/${encodeURIComponent(id)}/handover`, { technicianId, reason }),
  acceptHandover: (id: string) => request<Incident>('POST', `/incidents/${encodeURIComponent(id)}/handover/accept`),
  /** Returns a confirmation, not the incident: after declining you can no longer open it. */
  declineHandover: (id: string, reason: string) =>
    request<{ id: string; message: string }>('POST', `/incidents/${encodeURIComponent(id)}/handover/decline`, { reason }),
  withdrawHandover: (id: string) => request<Incident>('POST', `/incidents/${encodeURIComponent(id)}/handover/withdraw`),
  handoff: (id: string, target: { team?: string; technicianId?: number }, workDone: string) =>
    request<Incident>('POST', `/incidents/${encodeURIComponent(id)}/handoff`, { ...target, workDone }),
  message: (id: string, text: string) => request<Incident>('POST', `/incidents/${encodeURIComponent(id)}/messages`, { text }),
  feedback: (id: string, rating: number) => request<Incident>('POST', `/incidents/${encodeURIComponent(id)}/feedback`, { rating }),
  requestInfo: (id: string, question: string) => request<Incident>('POST', `/incidents/${encodeURIComponent(id)}/info-request`, { question }),
  provideInfo: (id: string, answer: string) => request<Incident>('POST', `/incidents/${encodeURIComponent(id)}/info-response`, { answer }),

  services: () => request<Service[]>('GET', '/services'),
  categories: () => request<Category[]>('GET', '/categories'),
  strategies: () => request<string[]>('GET', '/assignment-strategies'),
  technicians: () => request<Technician[]>('GET', '/technicians'),
  myWorkload: () => request<Technician>('GET', '/technicians/me'),

  notifications: () => request<{ items: Notification[]; unread: number }>('GET', '/notifications'),
  readNotification: (id: number) => request<void>('POST', `/notifications/${id}/read`),
  readAllNotifications: () => request<void>('POST', '/notifications/read-all'),
  emailOutbox: () => request<EmailOutboxEntry[]>('GET', '/notifications/outbox'),

  overview: () => request<Overview>('GET', '/reports/overview'),

  // IT manager administration
  admin: {
    users: () => request<AdminUser[]>('GET', '/admin/users'),
    createUser: (account: NewAccount) => request<{ user: AdminUser; warning?: string }>('POST', '/admin/users', account),
    updateUser: (id: string, patch: { name?: string; department?: string | null; active?: boolean }) =>
      request<{ user: AdminUser }>('PATCH', `/admin/users/${encodeURIComponent(id)}`, patch),
    saveTechnician: (id: number | string, profile: { skill?: string; experienceYears?: number; available?: boolean }) =>
      request<Technician>('PUT', `/admin/technicians/${encodeURIComponent(String(id))}`, profile),
    services: () => request<Service[]>('GET', '/admin/services'),
    createService: (service: { name: string; category: string; criticality: Criticality; tatkalBookingPath: boolean }) => request<Service>('POST', '/admin/services', service),
    updateService: (id: number, patch: { name?: string; category?: string; criticality?: Criticality; tatkalBookingPath?: boolean }) =>
      request<Service>('PATCH', `/admin/services/${id}`, patch),
    slaPolicies: () => request<SlaPolicy[]>('GET', '/admin/sla-policies'),
    updateSlaPolicy: (priority: string, responseMinutes: number, resolutionMinutes: number) =>
      request<SlaPolicy>('PUT', `/admin/sla-policies/${priority}`, { responseMinutes, resolutionMinutes }),
    categories: () => request<Category[]>('GET', '/admin/categories'),
    createCategory: (label: string, team: string) => request<Category>('POST', '/admin/categories', { label, team }),
    updateCategory: (code: string, patch: { label?: string; active?: boolean; team?: string }) => request<Category>('PATCH', `/admin/categories/${code}`, patch),
    settings: () => request<Settings>('GET', '/admin/settings'),
    updateSettings: (defaultAssignmentStrategy: string) => request<Settings>('PUT', '/admin/settings', { defaultAssignmentStrategy })
  }
};
