# API contract

Base `/api/v1`. JSON over HTTPS in deployment. Server derives actor and role from authentication, never from a client-supplied role. Use ISO 8601 UTC timestamps. Return server-calculated priority, SLA deadlines and permitted actions; frontend suggestions are advisory.

**Status (Phase 1, branch `feat/api`):** health and all `/auth/*` endpoints are implemented. Every other endpoint below exists with its final role check: it returns 401 without a token, 403 for the wrong role, and 501 `NOT_IMPLEMENTED` for an allowed role until its handler is built. The role rules live in `backend/routes/planned.ts`.

## Working with the backend

- Run it: `npm run api` (or `npm run api:dev` to restart on file changes), then `npm run dev`. Vite forwards `/api` to port 3001, so the frontend calls relative URLs like `/api/v1/auth/login` with no CORS setup.
- Demo accounts are seeded on start (`backend/seed/demoUsers.ts`): `employee@`, `ops@`, `tech.app@`, `tech.infra@`, `tech.payments@`, `lead@` (team lead) and `manager@demo.local`. They share one password, set in that file or with `DEMO_PASSWORD` in `.env`.
- Auth: `POST /auth/login` returns `{token, expiresAt, user}`. Send `Authorization: Bearer <token>` on every other call. Sessions last 8 hours. Five failed logins for one email lock it for 15 minutes (429).
- Errors: throw a subclass of `AppError` from `backend/errors.ts`; the error middleware turns it into the JSON error shape below. Domain errors should extend the matching class (for example `InvalidTransitionError extends ConflictError`).
- Storage: routes and services depend only on the interfaces in `backend/repositories/types.ts`. Phase 1 uses in-memory versions (data resets on restart). SQLite versions go in `backend/db/` and are swapped in at `backend/server.ts`.
- Backend TypeScript runs through Node's type stripping, so do not use `enum`, `namespace`, or constructor parameter properties (`constructor(private x)`), and import types with `import type`.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/health` | Public health check. **Implemented** |
| POST | `/auth/register` | `{name, email, password}` → 201 `{user}`. Creates an Employee only; any `role` field is ignored. **Implemented** |
| POST | `/auth/login` | `{email, password}` → `{token, expiresAt, user}`. **Implemented** |
| POST | `/auth/logout` | Revokes the current token → 204. **Implemented** |
| GET | `/auth/me` | `{user}` for the current token. **Implemented** |
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
