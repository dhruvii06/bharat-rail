# Java contributions

Source modules imported from RailwayITSM-OOP-Java.zip and irctc-itsm.zip. Original package namespaces and domain behavior are preserved. Generated target/classes output is excluded.

- `domain/`: Java OOP model, lifecycle rules, assignment strategies, simulated notifications, diagrams and 30 executable checks.
- `persistence/`: PostgreSQL JDBC repositories, persistence DTOs, schema and seed data.

## Build and check

Use JDK 21+ and Maven. From this directory run `mvn verify` to compile both modules. Run the domain checks with `mvn -f domain/pom.xml test-compile exec:java -Dexec.mainClass=com.railway.itsm.DomainModelChecks -Dexec.classpathScope=test`.

For the database, set ITSM_DB_PASSWORD in your environment, then run `docker compose -f persistence/docker-compose.yml up -d`. Database initializes only on a fresh volume. ITSM_DB_URL defaults to jdbc:postgresql://localhost:5432/irctc_itsm and ITSM_DB_USER to itsm_user. Schema creation no longer drops tables. Seed accounts are demonstration records, not production login credentials.

Run the database demonstration only against disposable seeded data: it modifies INC-1002 resolution and feedback. `mvn -f persistence/pom.xml compile org.codehaus.mojo:exec-maven-plugin:3.4.1:java -Dexec.mainClass=com.irctc.itsm.DatabaseSmokeTest`.

## Integration boundary

These are buildable Java modules, not yet a running web backend. The existing React frontend and Express authentication API remain the active web stack. Java does not run inside Node automatically.

The domain uses UUID identities and its own Incident aggregate; JDBC uses numeric user IDs and string incident IDs with separate DTOs. A transactional mapping adapter and HTTP/service integration are still required before the web app can use these repositories. Do not directly pass one Incident type to the other. Priority thresholds also differ: Java uses 20/10/5 while the TypeScript demo uses 18/8/3. Resolve this policy explicitly when connecting the application.

Validation on import: all Java sources compiled with --release 21; all 30 domain checks passed. Live PostgreSQL verification was not performed. Included original test-results and demo-output files are contributor evidence, not new execution results.
