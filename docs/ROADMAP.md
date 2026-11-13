# Course delivery checklist

## Implemented foundation

- React + TypeScript routes, role-specific queue views and replaceable CSS.
- Incident form, priority calculation, illustrative SLA deadlines.
- Six filters: text, status, priority, service, category, SLA.
- Demo lifecycle guards, resolution entry, history and browser persistence.
- Two assignment strategy classes (skill-based default).
- Domain tests and GitHub Actions build check.

## Remaining MVP work

- Real registration/login, password protection, server role and ownership authorization.
- Incident context edits, notes, requests for information, feedback and verification rejection/reopen policy.
- Technician acceptance/availability management and selectable assignment strategy.
- Database-backed users, services, categories, incidents, policies, histories and resolutions.
- SLA policy configuration, continuous monitoring, approaching-deadline warnings and persisted violations.
- Two notification mechanisms: proposed in-app plus simulated email outbox.
- Two intelligent features: proposed duplicate suggestions and skill/workload recommendations. Priority calculation alone must not be assumed to satisfy the entire intelligent-feature requirement.
- Manager user/service/category administration and complete reports/audit views.
- Backend OOP model with at least two implemented design patterns, final UML/use cases and ER/schema diagrams.
- Full testing evidence, technology justification report and three recorded complete workflows.
- Visual design and accessibility review when UI direction is provided.

## Integration acceptance scenarios (pending, not claimed as passed)

1. Valid employee login establishes a session.
2. Invalid password returns a safe error.
3. Employee cannot access another employee’s incident.
4. Technician cannot modify someone else’s assignment.
5. Manager can assign an eligible available technician.
6. Missing suitable technicians returns an actionable error.
7. Skill strategy respects category eligibility.
8. Load strategy balances active work with deterministic ties.
9. Invalid priority factor is rejected at the server boundary.
10. P1 creation uses configured response and resolution deadlines.
11. Direct classified-to-closed transition is rejected.
12. Resolution requires meaningful details.
13. Reporter verification permits manager closure.
14. SLA boundary equality is within target; late acknowledgement records violation.
15. Completed incidents retain historical SLA violations.
16. Duplicate suggestion does not silently merge separate reports.
17. Database changes and audit events commit atomically.
18. Two notification channels record delivery or simulation outcomes.
19. Network failure preserves form text and permits safe retry.
20. Concurrent transitions reject stale versions without duplicate events.

Automated domain tests cover priority boundaries, invalid factors, role transition rules and SLA timing. These scenarios are broader future acceptance criteria, not evidence that the full backend is complete.
