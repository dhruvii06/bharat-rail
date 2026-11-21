# Railway IT Service Impact Simulator — Demo / Viva Notes

## What this feature does

An IT Manager can select a failed technical service or optionally match an existing reported incident to a modelled service. A deterministic dependency graph finds direct and indirect dependents using breadth-first search (BFS) and displays hypothetical impact paths, advisory severity and response suggestions.

**No incident is created, reprioritized, resolved or modified by the simulator.** Existing Java priority rules and PostgreSQL records remain authoritative. There are no live IRCTC integrations, passenger metrics, outage telemetry or official service dependencies.

## How to demonstrate

1. Sign in as IT Manager and select **Impact simulator** in navigation.
2. Select **UPI Payment Gateway**; show the direct impact on Tatkal, general booking, confirmation and refunds, with indirect impact on notifications.
3. Select **Booking Database** to demonstrate a larger cascade.
4. Select **Catering Orders** to demonstrate an isolated service.
5. Optionally select an existing incident. The mapping recognizes the five seed names including NGET_CORE_DATABASE, UPI_PAYMENT_GATEWAY and E_CATERING_PORTAL. Unknown mappings are stated explicitly.

## Java / OOP design

Java implementation: com.railway.itsm.domain.impact.ServiceDependencyGraph.

- ServiceNode is an immutable record with id, support owner, criticality, and outgoing dependency edges.
- AffectedService is an immutable record with depth and shortest path.
- ImpactReport is an immutable record containing the simulation result and explanations.
- Graph construction validates unique identifiers and dangling edges.
- BFS traversal uses a queue and visited set, preventing infinite cycles and duplicate results.
- Edges point from a failed service to a potentially dependent service.
- BFS traversal is O(V+E), plus path-copy overhead for the explanations.

A separate TypeScript implementation in shared/impactSimulator.ts drives the React page src/pages/ImpactSimulator.tsx. The page is manager-only and makes no mutation calls. The running web application does not call Java for this advisory feature. Existing Strategy/Observer/Repository modules and incident workflows are untouched.

## Automated checks

Node tests in tests/impactSimulator.test.mjs exercise direct/indirect paths, cycles, invalid nodes, aliases, zero-dependency cases and determinism. Java DomainModelChecks includes six checks for the new graph.

Run:
- npm ci
- npm test
- npm run build
- mvn -B -f java/pom.xml verify
- mvn -B -f java/domain/pom.xml test-compile exec:java -Dexec.mainClass=com.railway.itsm.DomainModelChecks -Dexec.classpathScope=test

The project's GitHub Actions run Node and Java verification. Confirm both are green in the draft pull request before merging.

## Presentation strategy

Demonstrate the baseline reporting → assignment → resolution workflow first. Then switch to the simulated UPI failure and explain the propagation paths, escalation recommendations, BFS graph traversal, and explicit separation between predicted risk and confirmed incidents. Include screenshots and a concise UML class diagram in the report.

## Additional high-value extensions (not implemented by this PR)

1. An interactive audit-timeline replay of incident actions and SLA escalation.
2. A human-reviewed post-incident RCA report generator from actual incident history.
3. An explainable SLA breach forecast based on actual workload and remaining time.
4. A local-only synthetic failure/load testing harness to demonstrate scalability safely.

These may strengthen the technical-depth and innovation rubric, but cannot guarantee full marks. Complete mandatory test evidence, architecture/ER diagrams, three workflow demos, report and video first.
