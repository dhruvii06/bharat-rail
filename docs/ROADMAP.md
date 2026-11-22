# Course delivery status and evidence checklist

Updated for the integrated React → Node → Java 21 → PostgreSQL system on 22 November 2026. This file replaces the earlier prototype roadmap; do not present old SQLite or browser-only storage as the current solution.

## Implemented in the source code

- Role-aware Employee, Customer, Technician, and IT Manager screens; account management, authentication, forced password change, and server-side role checks.
- Incident reporting, editing, classification, 20/10/5 priority scoring with security and eligible Tatkal overrides, assignment, investigation, resolution, verification, and closure.
- Skill-based and load-based assignment; technician capacity, availability, handover, handoff and handback.
- Configurable SLA targets; background response/resolution warnings, violations and escalation.
- Event-driven in-app notifications and simulated email outbox.
- Audit trails, search across incidents, incident history and reporting; nine incident filters in the React UI.
- Duplicate incident suggestions and a deterministic, educational service-dependency impact simulator.
- PostgreSQL persistence and transaction-scoped incident, audit and notification writes.
- Dynamic incident categories associated with support teams, configurable services and SLA policies.
- Accessibility-oriented light/dark theme and supplied Bharat Rail ITSM branding.
- Unit/API tests, Java domain checks, and full-stack test scripts in `tests/e2e/`.

**Important:** Implementation means present in source, not automatically verified in a live browser. Full-stack E2E test success and the final report/video must be demonstrated separately.

## Commands to verify before the demonstration

```bash
npm ci
npm test
npm run build
mvn -B -f java/pom.xml verify
mvn -B -f java/domain/pom.xml test-compile exec:java -Dexec.mainClass=com.railway.itsm.DomainModelChecks -Dexec.classpathScope=test
```

For full-stack tests use the database and running services, following README.md and docs/TESTING-EVIDENCE.md:

```bash
npm run db:setup
npm run service:build
npm run service
npm run api
npm run test:e2e
```

The service, API and test runner require separate terminals unless launched by a CI workflow. E2E tests modify test data; use a disposable testing database, not a presentation database you wish to preserve.

## Remaining submission evidence (do not claim complete without checking)

- [ ] Capture output of the end-to-end suites against a clean PostgreSQL/Java/Node environment.
- [ ] Manually test the React website in light and dark mode, on desktop/mobile and across all four roles.
- [ ] Render and verify the latest UML class diagram in `java/domain/docs/domain-class-diagram.mmd`, plus a use case diagram.
- [ ] Add the final database schema/ER diagram with real table relationships.
- [ ] Document at least 15 meaningful test cases and include actual pass/fail evidence.
- [ ] Include a technology selection report, architecture, security considerations and how OOP concepts are applied.
- [ ] Record at least three complete end-to-end workflows, including reporting through closure.
- [ ] Confirm member responsibilities, group number, final video filename, and submission cut-off.

## Known limitations and assumptions

- Fictional Bharat Rail organization; no live Indian Railways/IRCTC integration.
- Emails are simulated; external email delivery is not included.
- Incident impact simulator shows hypothetical service dependencies, not monitored production telemetry.
- Node login sessions are stored in memory and are lost on restart.
- Frontend priority is an **estimate**. Java calculates and stores the final priority, including trusted service and category information.
- Enterprise production hardening (TLS termination, scalable sessions, secrets management, expanded request-rate limits and observability) is beyond course MVP scope.

## Source of truth

Use `docs/ARCHITECTURE.md`, `docs/API.md`, `README.md`, the actual Java/TypeScript files and test results as the basis for the final report. The earlier roadmap, screenshots, and prototypes should not override the running implementation.
