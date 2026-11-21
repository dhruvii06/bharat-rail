# Railway-ITSM — Domain Model / OOP (Java 21)

## Overview

Standalone, **simulated** Java domain module for the college project *Intelligent IT Service Management & Incident Resolution System*. The organization is modelled as an IRCTC-like railway ticketing operator. **This code does not integrate with IRCTC, live train booking, real UPI payments, or production passenger data.**

Student responsibility: **Domain Model / OOP**. It is designed for teammates to connect a Spring Boot REST API and persistence implementation.

## What's included

- **Domain:** abstract `User` superclass, `Employee`, `Technician`, `Administrator`, `Incident`, `RailwayService`, immutable `SLAPolicy`, `Resolution`, `AuditEntry`.
- **Enums:** incident category/status, impact, urgency, priority, technician skills.
- **Business rules:** status sequence `NEW → CLASSIFIED → ASSIGNED → ACKNOWLEDGED → IN_PROGRESS → RESOLVED → VERIFIED → CLOSED`; authorized technician/reporter checks; SLA response and resolution tracking.
- **Priority strategy:** impact (1–3) × urgency (1–3) × service criticality (1–3); ≥20 P1, ≥10 P2, ≥5 P3, else P4. Critical security issues and peak-Tatkal incidents with maximum impact/urgency are P1 overrides. These are **project-defined rules**, not official IRCTC policies. `affectedUsers` is recorded but currently does **not** change priority.
- **Two technician assignment strategies:** skill match and workload-based selection (both require availability, relevant skill, and remaining capacity).
- **Observer:** `EventPublisher`, `IncidentListener`, simulated email and in-app notifications for reported/prioritized/assigned events.
- **Persistence contract:** `IncidentRepository` plus **in-memory demonstration implementation**. It is not persistent across restarts. The database teammate must implement the repository contract using a database and transaction boundaries.
- **Intelligent examples:** explainable automatic prioritization, technician recommendations, duplicate candidate matching, and warning flag for incidents nearing SLA.
- **Testing:** 30 dependency-free automated domain checks, including valid, invalid, and security-sensitive cases.

## How to run (Windows PowerShell or CMD, Java 21)

With Maven installed:

```bash
mvn compile
mvn exec:java -Dexec.mainClass=com.railway.itsm.demo.Main
```

Without Maven, from the project root (Windows PowerShell):

```powershell
New-Item -ItemType Directory -Force out | Out-Null
$sourceFiles = Get-ChildItem -Recurse src/main/java -Filter *.java | ForEach-Object FullName
javac -d out $sourceFiles
java -cp out com.railway.itsm.demo.Main
```

To run all domain checks without Maven (Windows PowerShell):

```powershell
$sourceFiles = Get-ChildItem -Recurse src -Filter *.java | ForEach-Object FullName
javac -d out $sourceFiles
java -cp out com.railway.itsm.DomainModelChecks
```

Expected last line: `TOTAL: 30 checks passed`.

## Project structure

```text
src/main/java/com/railway/itsm/
  domain/
    enums/       Priority, IncidentStatus, IncidentCategory, Impact, Urgency, Skill
    model/       User hierarchy, Incident, RailwayService, SLA, Resolution, AuditEntry
    strategy/    PriorityStrategy, RailwayPriorityStrategy, AssignmentStrategy,
                 SkillBasedAssignmentStrategy, LoadBasedAssignmentStrategy
    events/      IncidentEvent, EventPublisher, IncidentListener, NotificationSender
    exceptions/  DomainException, InvalidTransitionException, NoTechnicianAvailableException
    repository/  IncidentRepository
  application/   IncidentManagementService
  infrastructure/InMemoryIncidentRepository, simulated Email/InApp notifications
  demo/          Main
src/test/java/com/railway/itsm/DomainModelChecks.java
docs/domain-class-diagram.mmd

docs/architecture.png
```

## Demonstration scenario

1. Employee reports `UPI payment failing during Tatkal` for a critical railway payment service.
2. `RailwayPriorityStrategy` classifies the incident **P1**.
3. `LoadBasedAssignmentStrategy` selects an available payment technician.
4. Technician acknowledges and investigates.
5. Technician resolves with root-cause information.
6. Original reporter verifies; administrator closes.
7. Audit events and SLA checks can be inspected. Email/in-app events are printed in the console as simulation.

## OOP and design pattern explanation (for presentation)

| Concept | Where demonstrated |
| --- | --- |
| Encapsulation | `Incident` uses private state; business methods guard status changes |
| Inheritance | `Employee`, `Technician`, `Administrator` extend abstract `User` |
| Abstraction | `PriorityStrategy`, `AssignmentStrategy`, `IncidentRepository` interfaces |
| Polymorphism | Swap `SkillBasedAssignmentStrategy` and `LoadBasedAssignmentStrategy` |
| Composition | Incident contains SLA configuration, resolution, and audit entries |
| Association | Incident refers to reporter, assigned technician, and railway service |
| Strategy pattern | Priority calculation and technician selection |
| Observer pattern | Event publisher notifies subscribers |
| Repository pattern | Domain depends on storage interface, not SQL |
| Exceptions | Illegal transitions, unavailable technicians, invalid inputs |
| Collections | Lists, Sets, Map, read-only audit history |

## Integration contract for teammates

- **Backend teammate:** call `IncidentManagementService.report(incident)` then `classifyAndAssign(incident, administrator, technicians, now)`. Subsequent lifecycle methods are on the `Incident` entity. Wrap these operations in transactions when using a real database.
- **Database teammate:** implement `IncidentRepository`, with `save`, `findById` and `findAll`, plus persistence for users/services/audit/SLA. Prefer storing timestamps in UTC and using UUID primary keys.
- **Frontend teammate:** expose role-specific flows for report, technician acknowledgment, investigation, resolution, reporter verification, and administrator closure. Never directly mutate `Incident.status`.
- **Testing teammate:** add API/integration tests for access control and storage/restart behavior. Current automated checks cover the domain only.

## Scope notes / limitations

- The college **group MVP** also requires user registration/login, role-based security at API level, five filter criteria, real persistent data storage, incident updates, and broader notification handling. These belong to the integrated app; they are **not** claimed as finished here.
- `InMemoryIncidentRepository` is a demonstration adapter only. **Do not present it as a permanent database.**
- `findPotentialDuplicates` is a basic keyword heuristic and may yield false positives/negatives. It only **suggests** matches and never deletes incidents.
- SLA deadlines are computed from creation time, use calendar elapsed time and example targets from the college specification. A production version needs policy versioning, business-hour calendars where required, pause rules, and time-zone/legal review.
- The sample simulated notification components print to console; real email/SMS delivery and asynchronous event reliability are future integration work.
- Changes to status, notes, notifications and audits should be orchestrated through the application service in the integrated system, with durable transaction handling and permissions.
- Java 21 is required by this module; decide with the group whether to use it across the backend.

## Source specification and deadline

Based on the supplied 17-page **OOP S1 2026–2027 Project** brief (esp. pages 3–10, 14–17). The brief specifies **at least two design patterns, two assignment strategies, two automated features, and at least 15 meaningful test cases** for the integrated team project. Submission deadline stated there: **22 November 2026**.
