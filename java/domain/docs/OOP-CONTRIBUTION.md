# Student 3 — Domain Model / OOP Contribution

**Project:** Intelligent Railway IT Incident Management System (Railway-ITSM)

## Objective
Design reusable Java classes and business logic for a simulated IT incident-response platform used by a railway ticketing organization. The implementation prioritizes user-reporting incidents, technician assignment, SLA commitments, auditability, and safe status transitions.

## Responsibility
My module establishes the real-world domain entities and their behavior, exposes service contracts to other teammates, and demonstrates inheritance, encapsulation, abstraction, polymorphism, association, and composition.

## Domain objects

- **User (abstract):** common user identity; `Employee`, `Technician`, and `Administrator` subclasses.
- **Incident:** core aggregate with reporter, affected railway service, category, impact, urgency, priority, workflow status, assigned technician, SLA, resolution, and audit entries.
- **RailwayService:** the affected functional service and its criticality (1–3).
- **Technician:** skills, availability, current workload, and maximum capacity.
- **SLAPolicy/SLAEvaluator:** example SLA response/resolution targets and evaluation results.
- **AuditEntry/Resolution:** immutable evidence of activity and the recorded resolution.

## Design decisions

### Strategy Pattern
`PriorityStrategy` separates policy from the `Incident` entity. `AssignmentStrategy` supports both skill-based and load-based selection. This permits policy changes without rewriting incident behavior.

### Observer Pattern
`EventPublisher` supports registered listeners. Email and in-app listeners currently provide a console simulation.

### Repository Pattern
`IncidentRepository` is an interface that can be implemented as a real database adapter. The included in-memory adapter is only for demonstration.

### Business rules

| Score or condition | Priority |
|---|---|
| Critical security override; or Tatkal peak with impact 3 and urgency 3; or score ≥20 | P1 |
| Score 10–19 | P2 |
| Score 5–9 | P3 |
| Score 1–4 | P4 |

`score = impact × urgency × businessCriticality` (each factor 1–3). These are original **prototype assumptions**, not sourced IRCTC business policies.

**Incident lifecycle:** NEW → CLASSIFIED → ASSIGNED → ACKNOWLEDGED → IN_PROGRESS → RESOLVED → VERIFIED → CLOSED. Operations check current status and authorized actor. The assigned technician must acknowledge, investigate and resolve; the reporting employee verifies; an administrator closes.

**SLA illustration from the brief:** P1: 5m/30m; P2: 15m/2h; P3: 1h/8h; P4: 4h/24h (response/resolution). `SLAEvaluator` detects overdue response, overdue resolution, and a near-resolution-deadline warning.

## Sample workflow
Employee submits a peak Tatkal payment failure affecting 5,000 users. The railway payment service criticality is 3, impact is HIGH, urgency is HIGH, hence the incident becomes P1. An available payment-skilled technician is assigned. The technician acknowledges, investigates and supplies a root cause. The employee verifies, administrator closes, and an eight-entry audit history remains available.

## Testing and outcomes

`DomainModelChecks.java` runs **30 executable checks** spanning priority P1–P4, status transitions, SLA response and resolution compliance, technician skill/capacity/workload, role-specific actions, event notifications, repository access, duplicate-detection candidates, and invalid input rejection.

## Integration boundary
Backend/API, authentication, persistent database, dashboards, and full reporting are team deliverables, not completed functionality in this submodule. The code compiles independently on Java 21 and is ready for integration and further testing.
