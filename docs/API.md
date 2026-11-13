# Proposed API contract (not implemented)

Base `/api/v1`. JSON over HTTPS in deployment. Server derives actor and role from authentication, never from a client-supplied role. Use ISO 8601 UTC timestamps. Return server-calculated priority, SLA deadlines and permitted actions; frontend suggestions are advisory.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/health` | Implemented starter health check |
| POST | `/auth/login` | Proposed authenticated session |
| POST | `/auth/logout` | Revoke session |
| GET | `/auth/me` | Current actor and role |
| GET | `/incidents` | Role-scoped, paginated queue |
| POST | `/incidents` | Validate, classify, prioritise and record creation |
| GET | `/incidents/:id` | Authorized detail with history |
| PATCH | `/incidents/:id` | Permitted description/context edits with audit |
| POST | `/incidents/:id/assignment` | Manager chooses strategy or technician |
| POST | `/incidents/:id/transitions` | Validate action and actor, update atomically |
| POST | `/incidents/:id/notes` | Authorized investigation/report updates |
| GET | `/technicians` | Availability, skills and workload |
| GET | `/services` | Service catalogue |
| GET | `/notifications` | In-app notifications |
| GET | `/reports/overview` | Manager analytics |

Incident POST payload matches `IncidentInput` in `shared/domain.ts`. Add affected-user count, financial/security impact and Tatkal context after agreeing the priority policy. Creation returns `201` with an Incident DTO. Queue returns `{items: Incident[], total: number, page: number, pageSize: number}`. Support query, status, priority, service, category, assignee, SLA and creation-date filters. All filters must preserve authorization scope.

Transition body: `{action: "ACKNOWLEDGE" | "START" | "RESOLVE" | "VERIFY" | "CLOSE", resolution?: string, expectedVersion: number}`. Return updated Incident and version; reject stale edits with 409. Assignment body: `{strategy: "skill" | "load", technicianId?: string, expectedVersion: number}`. Keep assignment separate from generic transitions.

Errors: `{error: {code: string, message: string, fieldErrors?: Record<string,string>}}`. Use 400 for malformed requests, 422 for invalid input, 401 for unauthenticated, 403 for forbidden, 404 for absent/inaccessible resources, 409 for invalid transition/concurrency, and 503 for unavailable dependencies. Show useful frontend feedback; never expose stack traces.

Integration sequence: implement auth and scoped reads, add an HTTP `IncidentApi` adapter, map DTOs, then integrate create/assignment/transitions. The current `advance` method is a demo convenience; HTTP adapter should map it to explicit server actions. Test network errors and rejected mutations before removing the demo banner. Configure a same-origin proxy or explicit development CORS allowlist. The starter health server does not configure CORS or accept business mutations.
