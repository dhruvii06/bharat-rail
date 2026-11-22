# Submission test evidence and reproducibility

This document describes **how to produce genuine evidence** for the course requirements. It does not claim that every full-stack test has already passed unless a corresponding GitHub Actions run has succeeded.

## Automated checks and evidence

| Layer | Command | What it proves |
|---|---|---|
| React/Node | `npm ci && npm test && npm run build` | TypeScript build, Node domain/API tests, priority-preview edge cases and logo/theme tests |
| Java unit/model | `mvn -B -f java/pom.xml verify` | Domain, persistence and service modules compile and unit tests pass |
| Java domain checks | `mvn -B -f java/domain/pom.xml test-compile exec:java -Dexec.mainClass=com.railway.itsm.DomainModelChecks -Dexec.classpathScope=test` | Model rules, strategies, SLA logic, custom exceptions and graph analysis |
| Full stack | `npm run test:e2e` | Calls Node API backed by Java and PostgreSQL; exercises actual stateful workflows |
| Transaction semantics | `TransactionCheck` via E2E runner | Confirms PostgreSQL rollback and commit behavior, if the compiled test classes are present |

The GitHub workflow `.github/workflows/integration.yml` now starts a fresh PostgreSQL 16 service and builds Java, starts the Java and Node services, then executes the full E2E suites. **Check the Actions run status** and use its URL/screenshot as evidence; do not infer a pass from a workflow file alone.

## Local end-to-end reproduction

Use JDK 21, Maven, Node 22.16+, npm, and PostgreSQL 16. Follow `README.md` to initialize the database.

```bash
cp .env.example .env
# Fill ITSM_DB_PASSWORD in .env to match the local PostgreSQL role.
docker compose --env-file .env -f java/persistence/docker-compose.yml up -d
npm ci
npm run service:build
```

With the environment configured, launch three terminals:

```bash
npm run service
```

```bash
npm run api
```

```bash
npm run dev
```

From a fourth terminal, execute:

```bash
npm run test:e2e
```

Tests create new incidents and change administrator settings; use a disposable database or restore a test snapshot. The script prints pass/fail counts for administration, customer flows, priority overrides, editing/audit, technician collaboration and SQL transaction behavior. Do not record or publish real credentials or passenger information.

## Test-case table for the report (fill actual results from CI or a local run)

| ID | Test scenario | Expected outcome | Script/source |
|---|---|---|---|
| T01 | Valid demo sign-in | Successful session | `tests/e2e/admin.mjs` |
| T02 | Wrong role attempts manager settings | HTTP 403 | `tests/e2e/admin.mjs` |
| T03 | Add technician and set skills | Saved, available technician | `tests/e2e/admin.mjs` |
| T04 | Update SLA policy | New incidents use new targets; existing deadlines unchanged | `tests/e2e/admin.mjs` |
| T05 | Disable category | Hidden from report form, rejected by API | `tests/e2e/admin.mjs` |
| T06 | Register public user | Customer role only, regardless of role input | `tests/e2e/customer.mjs` |
| T07 | Customer incident | Customer sees no internal priority/SLA details | `tests/e2e/customer.mjs` |
| T08 | Customer and technician messages | Appropriate notifications; visible conversation | `tests/e2e/customer.mjs` |
| T09 | Manual priority override | Reason logged and appropriate SLA deadlines | `tests/e2e/priority.mjs` |
| T10 | Forbidden priority change | HTTP 403 | `tests/e2e/priority.mjs` |
| T11 | Custom security category | P1 override for security-team category | `tests/e2e/review-fixes.mjs` |
| T12 | Reporter edits new incident | Changes audited; unauthorized edit refused | `tests/e2e/review-fixes.mjs` |
| T13 | Manager changes category | Priority recalculated, unless manually overridden | `tests/e2e/review-fixes.mjs` |
| T14 | Filter full audit log | Correct entries, role restrictions and date filters | `tests/e2e/review-fixes.mjs` |
| T15 | Technician requests handover | Target notified; remains assigned until accepted | `tests/e2e/handover.mjs` |
| T16 | Decline/withdraw handover | Incident remains with original technician | `tests/e2e/handover.mjs` |
| T17 | Accept handover | Assignment and workload move, history preserved | `tests/e2e/handover.mjs` |
| T18 | Cross-team handoff | New qualified technician receives work | `tests/e2e/handover.mjs` |
| T19 | Database rollback | Partial command leaves no records | `TransactionCheck.java` |
| T20 | Database transaction commit | All changes persist atomically | `TransactionCheck.java` |
| T21 | Custom security category in UI preview | P1 regardless of code | `tests/priorityPreview.test.mjs` |
| T22 | Tatkal eligibility and boundary preview | Only booking-path, peak, high/high cases override | `tests/priorityPreview.test.mjs` |

**Actual result / screenshot / run ID:** Add results when executed. The table states expected outcomes, not fabricated pass statuses.

## Three demonstration workflows for the required video

1. **Employee → IT manager → Technician → Employee → IT manager:** report an incident, show priority/explanation and SLA, assign by strategy, acknowledge, start, resolve, verify and close. Show audit timeline and notifications.
2. **Customer → IT team:** customer registers, describes a problem without technical priority, receives updates; staff sends information request and the customer answers; demonstrate privacy separation.
3. **Manager + technician collaboration:** view workloads, request a handover, accept or decline, demonstrate SLA continuity and audit; optionally open the hypothetical dependency impact simulator to show graph BFS.

Show the complete workflow in the browser, not merely individual API requests. Demonstrate PostgreSQL persistence by refreshing/restarting and reloading the same incident if feasible.

## Document/diagram checklist

- [ ] Problem analysis and scope, assumptions and stakeholders
- [ ] Functional and nonfunctional requirements
- [ ] Architecture diagram: `docs/ARCHITECTURE.md`
- [ ] Use case diagram: `docs/USE-CASE-DIAGRAM.mmd` (render to image)
- [ ] Updated class diagram: `java/domain/docs/domain-class-diagram.mmd` (render and proofread)
- [ ] PostgreSQL ER diagram with correct actual relationships
- [ ] Technology selection rationale and alternatives
- [ ] Role-based security explanation and limitations
- [ ] At least 15 tests with actual outcomes and evidence
- [ ] Complete repository URL, demo video, group details and final PDF
