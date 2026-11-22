# API reference

Base `/api/v1` on the Node API (port 3001; the Vite dev server forwards `/api`). JSON in and out, ISO 8601 UTC timestamps. The server decides who the caller is from the session token, never from anything the client sends.

## Request path

1. **Node API** (`backend/`) authenticates the bearer token and checks the role for the endpoint (`backend/routes/incidents.ts`). Wrong role → 403 before anything else happens.
2. It forwards the request to the **Java incident service** (`java/service`, 127.0.0.1:8081) with headers `X-Actor-Id`, `X-Actor-Role` (EMPLOYEE / TECHNICIAN / ADMIN) and `X-Internal-Token`. The service listens on localhost only and rejects calls without the token.
3. The service loads the incident from PostgreSQL, rebuilds the domain object, and lets the domain rules decide (lifecycle order, "only the assigned technician", "only the reporter verifies", technician capacity). Then it saves through the transactional repositories and publishes an event for the notification observers.

## Auth (Node)

| Method | Endpoint | Behaviour |
| --- | --- | --- |
| GET | `/health` | Public health check |
| POST | `/auth/register` | `{name, email, password}` → 201 `{user}`. Public sign-up: always creates a **Customer**; any `role` field is ignored. Employee, technician and manager accounts are created by the IT manager |
| POST | `/auth/change-password` | `{currentPassword, newPassword}` → `{user}`. Accounts created by the IT manager start with `mustChangePassword: true`; until changed, every endpoint except `/auth/me`, `/auth/change-password` and `/auth/logout` answers 403 `PASSWORD_CHANGE_REQUIRED` |
| POST | `/auth/login` | `{email, password}` → `{token, expiresAt, user}`. 8-hour session. 5 failures on one email lock it for 15 min (429) |
| POST | `/auth/logout` | Revokes the token → 204 |
| GET | `/auth/me` | `{user}` for the current token |

Send `Authorization: Bearer <token>` on every other call.

## Incidents (forwarded to the Java service)

| Method | Endpoint | Roles | Behaviour |
| --- | --- | --- | --- |
| GET | `/incidents` | all | Role-scoped list: employees see their reports, technicians their assignments, managers everything. Filters: `q`, `status`, `priority`, `serviceId`, `category`, `technicianId`, `sla` (WITHIN / AT_RISK / BREACHED / MET), `from`, `to` (YYYY-MM-DD) |
| POST | `/incidents` | Employee | `{title, description, serviceId, category, impact 1-3, urgency 1-3, affectedUsers?, tatkalWindow?}` → 201 `{incident, possibleDuplicates}`. Priority from `RailwayPriorityStrategy`, SLA deadlines from the priority, duplicates from `IncidentManagementService` |
| POST | `/incidents` | Customer | `{title, description, serviceId, effect: BLOCKED / DEGRADED / MINOR, moneyTaken, stillHappening}`. Customers only describe: `CustomerReportAssessment` sets impact and urgency, the category comes from the service, and any impact, urgency, category, affected-user or Tatkal values they send are ignored |
| GET | `/incidents/:id` | all (if visible) | Detail with `history`, `resolution`, `allowedActions` and `similar` |
| PATCH | `/incidents/:id` | Reporter, Manager | `{title?, description?, category?}`. The reporter may correct title and description while the incident is new, classified or assigned (not after a technician acknowledges it); the IT manager may edit any open incident and is the only one who may change the category. A category change recalculates the priority (unless the manager had overridden it) and its deadlines. Recorded as INCIDENT_EDITED; the assigned technician is notified. Technicians get 403 |
| POST | `/incidents/:id/assignment` | Manager | `{strategy: "skill" \| "load"}` or `{technicianId}` |
| POST | `/incidents/:id/priority` | Manager | `{priority: P1-P4, reason}`. Overrides the calculated priority while the incident is open (classified to in progress); reason required; same priority refused. Deadlines are recalculated from creation time with the configured SLA targets. Recorded as PRIORITY_CHANGED; the assigned technician and managers are notified ("Priority changed"), the reporter is not |
| POST | `/incidents/:id/transitions` | by action | `{action: "ACKNOWLEDGE" \| "START" \| "RESOLVE" \| "VERIFY" \| "CLOSE"}`; RESOLVE also needs `summary` (10–4000) and `rootCause` (3–2000) |
| POST | `/incidents/:id/notes` | Staff (not customers) | `{text}`; internal note, never shown to customers |
| POST | `/incidents/:id/messages` | Reporter, assigned technician, IT manager | `{text}`; conversation between the reporter and the IT team, visible to both. Notifies the assigned technician (or the IT manager while unassigned) or the reporter (in-app and email). Not allowed once closed |
| POST | `/incidents/:id/feedback` | Employee (reporter) | `{rating: 1-5}` once the incident is resolved |
| GET | `/incidents/:id/similar` | Technician, Manager | Possible duplicates |
| GET | `/incidents/:id/colleagues` | Technician (assigned) | Technicians the assignee can hand over to: `{id, name, team, workload, capacity, available}` |
| POST | `/incidents/:id/handover` | Technician (assigned) | `{technicianId, reason}` asks a colleague to take the incident over; nothing moves until they accept. Without `technicianId` the incident goes back to the IT manager (status CLASSIFIED) to be reassigned. One open request at a time (409 otherwise); reason 5–500 characters |
| POST | `/incidents/:id/handover/accept` | Technician (asked) | The incident and its workload move to the colleague; status returns to ASSIGNED and they acknowledge it. The first acknowledgement time and the SLA deadlines are kept |
| POST | `/incidents/:id/handover/decline` | Technician (asked) | `{reason?}`. Returns `{id, message}`: the incident stays with the requester and is no longer visible to the decliner |
| POST | `/incidents/:id/handover/withdraw` | Technician (assigned) | Cancels an open request before the colleague answers |
| POST | `/incidents/:id/handoff` | Technician (assigned) | `{team \| technicianId, workDone}` for work that needs two teams: after acknowledging, the technician records what they did (10–2000 characters) and passes the rest on. With `team`, the available team member with the fewest active incidents is chosen (409 if none). Status returns to ASSIGNED; deadlines do not change |
| POST | `/incidents/:id/info-request` | Technician (assigned) | `{question}` while ACKNOWLEDGED or IN_PROGRESS; one open question at a time; blocks RESOLVE until answered |
| POST | `/incidents/:id/info-response` | Employee (reporter) | `{answer}`; clears the open question |
| GET | `/services`, `/categories` | all | Service catalogue (with criticality) and categories |
| GET | `/assignment-strategies`, `/technicians` | Manager | Strategy names; technicians with skill and workload |
| GET | `/notifications` | all | In-app channel: `{items, unread}` |
| POST | `/notifications/:id/read`, `/notifications/read-all` | all | Mark read → 204 |
| GET | `/notifications/outbox` | Manager | Simulated email channel |
| GET | `/reports/overview` | Manager | Totals, SLA compliance, average resolution time, by service / priority / status, workload |
| GET | `/audit` | Manager | Audit trail across all incidents, newest first. Optional filters: `q` (text in the entry or incident title), `action`, `incidentId`, `userId`, `from` / `to` (dates, inclusive), `limit` (1–500, default 200) |

## Customer view

Technicians who worked on an incident earlier (`contributors`) can still open it read-only, and the colleague asked to take an incident over can open it until they answer. The incident detail carries `handover` (the open request) and `contributors` (who passed it on, how and with what note) for staff.

For customers the service removes triage data from every response: `priority`, `priorityReason` and SLA deadlines are `null`, `sla` is `NONE`, impact, urgency and criticality are `0`, duplicates are not returned, priority/SLA filters are ignored, and the history only contains customer-facing entries (created, assigned, status changes, resolution, questions, answers, messages, feedback, and a neutral "Another specialist from our IT team is now handling your request" when a technician hands over or off; hand-over reasons and notes are never shown). Notifications to reporters never mention a priority.

## Administration (IT manager only)

| Method | Endpoint | Handled by | Behaviour |
| --- | --- | --- | --- |
| GET | `/admin/users` | Node | All accounts with department and active flag |
| POST | `/admin/users` | Node (+ Java for the technician profile) | `{name, email, password, role, department?, skill?, experienceYears?}`; `skill` (the technician's team) required for technicians |
| PATCH | `/admin/users/:id` | Node | `{name?, department?, active?}`; deactivated accounts are signed out and cannot sign in or be assigned; you cannot deactivate yourself |
| PUT | `/admin/technicians/:id` | Java | `{skill?, experienceYears?, available?}`; workload is kept |
| GET / POST | `/admin/services` | Java | `{name, category, criticality: CRITICAL / HIGH / MEDIUM / LOW, tatkalBookingPath?}`; `tatkalBookingPath` marks services Tatkal bookings depend on (only these get the Tatkal-window P1 rule) |
| PATCH | `/admin/services/:id` | Java | Any of name, category, criticality, tatkalBookingPath |
| GET | `/admin/sla-policies` | Java | Targets per priority in minutes |
| PUT | `/admin/sla-policies/:priority` | Java | `{responseMinutes, resolutionMinutes}`; resolution must be longer; applies to new incidents only |
| GET | `/admin/categories` | Java | All categories: `{code, label, active, team, standard}` |
| POST | `/admin/categories` | Java | `{label, team}`; adds a category handled by a technician team (APPLICATION, PAYMENT, DATABASE, NETWORK, SECURITY, AUTHENTICATION, API_INTEGRATION, INFRASTRUCTURE). The code is made from the label (e.g. "Mobile app" → MOBILE_APP). Categories handled by SECURITY count as security incidents. 409 if the name or code exists |
| PATCH | `/admin/categories/:code` | Java | `{label?, active?, team?}`; switched-off categories can't be reported; at least one must stay on |
| GET / PUT | `/admin/settings` | Java | `{defaultAssignmentStrategy: "skill" \| "load"}`, used when Assign is pressed without a choice |

`GET /categories` (all roles) returns only active categories as `{code, label}`.


## Lifecycle and who may act

`NEW → CLASSIFIED` (automatic on report) `→ ASSIGNED` (manager) `→ ACKNOWLEDGED → IN_PROGRESS → RESOLVED` (assigned technician) `→ VERIFIED` (reporter) `→ CLOSED` (manager). Anything else returns 409 `INVALID_TRANSITION`.

## Errors

`{error: {code, message, fieldErrors?}}`, the same shape from Node and Java.

| Status | Code | When |
| --- | --- | --- |
| 400 | BAD_REQUEST | Malformed JSON |
| 401 | UNAUTHENTICATED / INVALID_CREDENTIALS | No or expired session; wrong email or password |
| 403 | FORBIDDEN | Wrong role, or not the assigned technician / reporter |
| 404 | NOT_FOUND | Incident doesn't exist or isn't visible to you |
| 409 | INVALID_TRANSITION, NO_TECHNICIAN_AVAILABLE, CONFLICT | Domain rule refused the action |
| 422 | VALIDATION_FAILED | Invalid input |
| 429 | TOO_MANY_REQUESTS | Login lockout |
| 503 | SERVICE_UNAVAILABLE / DATABASE_UNAVAILABLE | Java service or database down |

## Background SLA monitor

Every `ITSM_SLA_CHECK_SECONDS` (default 30) the service evaluates open incidents with `SLAEvaluator`: missed targets are recorded once (`SLA_VIOLATED`), a warning is raised 5 minutes before the resolution deadline (`SLA_WARNING`), and P1/P2 incidents not acknowledged in time are escalated to the IT manager (`ESCALATED`). Each event goes to the history and the notification channels.

## Working on the code

- Backend TypeScript runs through Node's type stripping: no `enum`, `namespace` or constructor parameter properties; use `import type` for types.
- Throw a subclass of `AppError` (`backend/errors.ts`) in Node; Java maps domain exceptions in `java/service/.../http/ApiServer.java`.
- Node user storage depends only on `backend/repositories/types.ts` (in-memory for tests, PostgreSQL in `server.ts`).
