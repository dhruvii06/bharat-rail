# Java contributions

Source modules imported from RailwayITSM-OOP-Java.zip and irctc-itsm.zip. Original package namespaces and domain behavior are preserved. Generated target/classes output is excluded.

- `domain/`: Java OOP model, lifecycle rules, assignment strategies, simulated notifications, diagrams and 30 executable checks.
- `persistence/`: PostgreSQL JDBC repositories, persistence DTOs, schema and seed data.

## Build and check

Use JDK 21+ and Maven. From this directory run `mvn verify` to compile both modules. Run the domain checks with `mvn -f domain/pom.xml test-compile exec:java -Dexec.mainClass=com.railway.itsm.DomainModelChecks -Dexec.classpathScope=test`.

For the database, set ITSM_DB_PASSWORD in your environment, then run `docker compose -f persistence/docker-compose.yml up -d`. Database initializes only on a fresh volume. ITSM_DB_URL defaults to jdbc:postgresql://localhost:5432/irctc_itsm and ITSM_DB_USER to itsm_user. Schema creation no longer drops tables. Seed accounts are demonstration records, not production login credentials.

Run the database demonstration only against disposable seeded data: it modifies INC-1002 resolution and feedback. `mvn -f persistence/pom.xml compile org.codehaus.mojo:exec-maven-plugin:3.4.1:java -Dexec.mainClass=com.irctc.itsm.DatabaseSmokeTest`.

## How the modules connect (`service/`)

`service/` is the running incident service that joins the other two modules and serves them to the Node API over HTTP on 127.0.0.1:8081. Build it with `mvn package` (creates `service/target/itsm-service.jar`) and start it with `npm run service` from the repo root.

- **Identity mapping** (`app/Ids`, `app/Mapping`): database rows get stable name-based UUIDs, and enums are converted in one place (P1 ↔ P1_CRITICAL, ADMIN ↔ Administrator, CRITICAL service ↔ criticality 3).
- **Adapter** (`app/Snapshot`, `app/SnapshotIncidentRepository`): rebuilds domain objects from the JDBC DTOs through the new `Incident.restore(...)` and restore constructors on `User`, `Technician` and `RailwayService`, and exposes stored incidents through the domain's own `IncidentRepository` interface so duplicate detection works unchanged.
- **Application service** (`app/IncidentWorkflowService`): every command lets the domain validate the action first, then saves through the transactional repositories. Because the domain guarantees the incident is CLASSIFIED before assignment and IN_PROGRESS before resolution, the audit rows those repository methods write are correct.
- **Observers** (`notify/`): in-app and simulated email senders subscribe to `EventPublisher`; `NotificationPolicy` decides who hears about what.
- **SLA monitor** (`sla/SlaMonitor`): runs `SLAEvaluator` on open incidents to record violations, warn and escalate.
- **Database additions** (`persistence/src/main/resources/integration.sql`): `acknowledged_at` and `affected_users` columns, an incident number sequence, a `notifications` table, and demo technicians for every category. Seed emails now use `@demo.local`.

Priority policy: the web app now uses the Java rules (P1 ≥ 20, P2 ≥ 10, P3 ≥ 5, plus security and Tatkal overrides); the React form shows a preview using the same rules.

Validation on import: all Java sources compiled with --release 21; all 30 domain checks passed (38 now, including the restore and typed-exception checks). Live PostgreSQL verification: schema, seed, `integration.sql` and `DatabaseSmokeTest` ran against PostgreSQL 17, and the full report → assign → acknowledge → start → resolve → verify → close flow ran end to end through the web app. Included original test-results and demo-output files are contributor evidence, not new execution results.
