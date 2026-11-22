# Venika — Domain Model/OOP contribution (current integrated architecture)

## 1. Problem analysis

A fictional railway ticketing organization, Bharat Rail, depends on reliable booking, payments, login, PNR enquiry, database, security, network and support services. When a service fails, an incident must be reported, classified, prioritized, assigned, investigated, resolved, verified and closed. Manual handling can cause delays, missed SLAs, duplicated work and incomplete auditability.

**Stakeholders:** employees who detect incidents; customers who report problems with digital services; technicians responsible for diagnosis and repair; the IT manager who administers policies and handles escalations.

**Scope:** This is an IT incident management platform using railway operations as its chosen case study. It is **not** a train-booking application, a real IRCTC integration, or a system monitoring actual railway infrastructure.

## 2. Current architecture and component ownership

```text
React + TypeScript UI  →  Node/Express authenticated API  →  Java 21 service  →  PostgreSQL
                                                        ↘  Domain objects and strategies
                                                        ↘  Event/notification observers
```

- `src/` is the browser UI, where a priority **estimate** is displayed before submitting.
- `backend/` manages user login/session tokens, account administration and role authorization; it forwards incident requests to Java.
- `java/service/` hosts the live Java incident workflow, prioritization, assignment, SLA, audit and notification rules.
- `java/domain/` is the OOP core used by the Java service and demonstrated through independent domain checks.
- `java/persistence/` provides PostgreSQL schema and JDBC-backed repositories. Commands run inside shared database transactions.
- `shared/` holds TypeScript view/contract definitions and advisory UI logic.

The Java module is **integrated into the backend**; do not repeat the earlier statement that Java is a standalone proof-of-concept while SQLite powers the application.

## 3. Requirements

Functional: role-based reporting and viewing, editable incident details, priority/assignment, managed lifecycle, technician collaboration, SLA tracking, notifications through two channels, audit and incident history, searchable reporting, duplicate suggestions, dynamic categories, administrator settings, and persistence.

Nonfunctional: traceability, reliable state transitions, authorization, validation, testability, extensibility and modularity. External email delivery, a persistent session store and production observability are not implemented as enterprise features.

## 4. Priority policy

`score = impact × urgency × serviceCriticality` (each factor 1–3).

| Rule | Priority |
|---|---|
| Security-team category **or** eligible Tatkal booking-path incident with impact=3 and urgency=3 during a reported/current peak Tatkal window **or** score ≥ 20 | P1 Critical |
| Score 10–19 | P2 High |
| Score 5–9 | P3 Medium |
| Score 1–4 | P4 Low |

**Critical clarification:** administrators can create custom categories and assign them to the SECURITY team. These must trigger the security override; relying on category code `SECURITY` alone is incorrect. The Tatkal override applies only to services tagged as on the Tatkal booking path, with peak windows 10:00–10:30 / 11:00–11:30 IST. The frontend preview must consider these factors and is advisory; the backend remains the source of truth.

The IT manager may manually change priority on open incidents with a recorded reason. The affected-user count is recorded but is not currently a factor in the score. These rules are educational project decisions, not official railway policies.

## 5. OOP concept mapping

| Concept | Implementation |
|---|---|
| Encapsulation | `Incident` controls status, assignment, priority and information requests through validated methods. |
| Inheritance | `User → Reporter → Employee/Customer`; `User → Technician/Administrator`. |
| Abstraction | `PriorityStrategy`, `AssignmentStrategy`, `IncidentRepository` and `IncidentListener` define interfaces. |
| Polymorphism | Skill- and load-based assignment implement the same strategy interface; notification senders implement the listener contract. |
| Composition/aggregation | `Incident` owns resolution and audit records; relates to service, reporter, assigned technician and SLA policy. |
| Strategy | `RailwayPriorityStrategy`, `SkillBasedAssignmentStrategy`, `LoadBasedAssignmentStrategy`. |
| Observer | `EventPublisher` dispatches incident events to in-app and simulated-email listeners. |
| Repository | SQL-backed persistence with interfaces; in-memory repositories support independent domain tests. |
| Value objects | `IncidentCategory` (extensible code/team), `Resolution`, `SLAPolicy` and other immutable records. |
| Algorithms | `ServiceDependencyGraph` uses BFS to find hypothetical downstream service impact. |

See `domain-class-diagram.mmd` for the current class design. It includes reporter inheritance, technician handover, dynamic categories and the dependency simulator.

## 6. Exception handling

`InvalidTransitionException`, `NoTechnicianAvailableException`, `TechnicianUnavailableException`, `TechnicianWorkloadExceededException`, `SLAPolicyNotFoundException` and `UnauthorizedIncidentOperationException` are custom Java domain exceptions. Input validation also uses standard runtime exceptions. The API layers translate domain failures to user-facing HTTP error responses.

## 7. Testing and presentation evidence

Java domain checks: `mvn -B -f java/domain/pom.xml test-compile exec:java -Dexec.mainClass=com.railway.itsm.DomainModelChecks -Dexec.classpathScope=test`.

Live integration: `npm run test:e2e` requires a running PostgreSQL database, Java incident service and Node API. Run tests on an isolated/test database and save actual output, not a fabricated pass count. Follow `docs/TESTING-EVIDENCE.md`.

For the final report include: problem statement, assumptions, role-based requirements, architecture diagram, revised class and use case diagrams, ER diagram, the 20/10/5 priority rules, SLA/assignment strategies, exception hierarchy, at least 15 test cases with evidence, and screenshots of three complete workflows.

## 8. Important assumptions/limitations

- Bharat Rail is fictional and all incidents and service dependencies are simulated.
- Email is shown in the outbox, not delivered externally.
- Sessions are in-memory in the Node API; a server restart ends them.
- The impact simulator does not automatically change real ticket priority.
- Database performance, production security and external monitoring are not claimed beyond what has been implemented.
