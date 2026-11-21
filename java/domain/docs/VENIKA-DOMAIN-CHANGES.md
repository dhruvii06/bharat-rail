# Venika — Domain Model / OOP: Final Rules and Exception Handling

## Scope and implementation

This section documents the Java domain module in `java/domain`. The React + Node + SQLite application is the team's running demonstration, whereas the Java module independently demonstrates OOP principles. It is a **simulated IRCTC-like IT incident platform**, not an integration with the real IRCTC production system.

## Problem analysis

Railway ticketing relies on connected services for Tatkal/general booking, payment authorization, PNR generation, authentication and refunds. Uncoordinated incident handling can produce delayed response, misprioritization, duplicate reports and weak accountability. Our proposed ITSM system records incidents, calculates priority, selects qualified technicians, tracks SLA targets, prevents invalid state transitions and keeps an audit trail.

**Stakeholders:** passengers and employees reporting failures; technicians investigating and resolving; administrators/IT managers monitoring priorities, workload, SLAs, and service health.

**Assumptions:** impact and urgency are integers 1–3; each service has a business criticality of 1–3; severe-security and peak-Tatkal flags are supplied from trusted incident classification; example SLA policies are educational, not official IRCTC commitments.

## Requirements

Functional requirements:
1. Users report and inspect incidents with service, category, impact and urgency.
2. The system calculates and stores P1–P4 using a configurable strategy.
3. Technicians can be recommended by skill or current workload.
4. The incident lifecycle is NEW → CLASSIFIED → ASSIGNED → ACKNOWLEDGED → IN_PROGRESS → RESOLVED → VERIFIED → CLOSED.
5. Unauthorized actors and invalid transitions are rejected.
6. Response/resolution SLA targets and violations are trackable.
7. Incident actions are auditable and events can trigger notifications.
8. Potential duplicate incident reports can be suggested.

Non-functional requirements: modularity, testability, input validation, traceability/auditability, extensibility, and appropriate role-based authorization. The integrated team's API must secure endpoints and persist data; the Java standalone module does not implement the deployed web app.

## Final priority policy

`score = impact × urgency × businessCriticality` (each factor 1–3).

| Rule | Priority |
|---|---|
| Confirmed critical security incident OR peak Tatkal with impact=3 and urgency=3 OR score≥20 | P1 Critical |
| Score 10–19 | P2 High |
| Score 5–9 | P3 Medium |
| Score 1–4 | P4 Low |

Override flags must be validated and set by trusted application rules. Affected-user count is stored but currently does not adjust the score. **These are project-defined rules, not IRCTC policies.** The TypeScript web application still used different thresholds at the time of this branch: the backend owner must reconcile `shared/domain.ts` and associated Node tests before the live demo.

## Java exception hierarchy

- `DomainException` — common domain failure.
- `InvalidTransitionException` — incorrect status transition (already present).
- `NoTechnicianAvailableException` — strategy cannot find a suitable technician (already present).
- `TechnicianUnavailableException` — a directly selected technician is offline/unavailable.
- `TechnicianWorkloadExceededException` — technician's concurrent capacity reached.
- `SLAPolicyNotFoundException` — null/unconfigured priority requested.
- `UnauthorizedIncidentOperationException` — unassigned technician or non-reporter attempts a restricted incident action.

Invalid input still uses `IllegalArgumentException`; null required references can use `NullPointerException`. These are caught or mapped at a separate API boundary, not hidden inside the domain.

## UML and OOP mapping

See `domain-class-diagram.mmd` for detailed class relationships. `User` is abstract with `Employee`, `Technician`, and `Administrator` subclasses (inheritance). `Incident` protects status behind business operations (encapsulation). `PriorityStrategy`, `AssignmentStrategy`, and `IncidentRepository` define contracts (abstraction). Interchangeable `SkillBasedAssignmentStrategy` and `LoadBasedAssignmentStrategy` demonstrate polymorphism (Strategy pattern). `EventPublisher` delegates to `IncidentListener` observers (Observer pattern). Incident association with reporter, service, and technician is distinct from contained resolution and audit data.

## Java verification

The dependency-free `DomainModelChecks` runner now contains **36 checks**: previous 30 plus six additional cases for unavailable technician, missing SLA policy, P1/P2/P3 priority scores, and non-override low-impact Tatkal. Existing checks for workload capacity and unauthorized action were changed to require the new typed exceptions.

Run from `java/domain` with Java 21:

```powershell
$files = Get-ChildItem -Recurse src -Filter *.java | ForEach-Object FullName
New-Item -ItemType Directory -Force out | Out-Null
javac -d out $files
java -cp out com.railway.itsm.DomainModelChecks
```

Expected total: `TOTAL: 36 checks passed`. This branch was edited using the GitHub connector; the checks should be executed by GitHub Actions or a local checkout before merging.

## Final report merge checklist

Include Dhruvi's UI/screenshots and use case diagram, the backend developer's API/architecture/technology/security write-up, Ananya's SQLite schema/ER diagram and test-case table, and this document plus `domain-class-diagram.mmd`. Confirm group number, final upload cutoff and correct video filename before export. Do not claim Java is wired directly into the Node demo.
