# oop-irctc

Intelligent IT Service Management & Incident Resolution System (I-ITSM) for the CS F213 / MAC F212 OOP course, set in a fictional railway operator, **Bharat Rail**, modelled on IRCTC-style ticketing incidents. Student project; no live IRCTC integration.

## How the parts connect

```text
React UI (src/)  →  Node API (backend/)  →  Java incident service (java/service)  →  PostgreSQL
  login, screens      login, sessions,        domain rules (java/domain) +          (java/persistence
                      role checks             JDBC repositories (java/persistence)   schema + seed)
```

- **React UI**: one screen set per role (Employee, Technician, IT Manager). Talks only to the Node API.
- **Node API**: login, sessions, password hashing, role checks. Forwards incident requests to the Java service with the signed-in user's id and role.
- **Java incident service**: rebuilds the domain objects (java/domain) from the database rows (java/persistence), lets the domain decide whether each action is allowed (lifecycle, ownership, capacity), saves through the transactional repositories, and publishes events. Two observers deliver them: in-app notifications and a simulated email outbox. A background SLA monitor warns, records violations and escalates.
- **PostgreSQL**: one database shared by Node (users) and Java (everything else).

## Run it

You need Node.js 22.16+, JDK 21 + Maven, and PostgreSQL (Docker or a local install).

1. **Settings.** Copy `.env.example` to `.env` and set `ITSM_DB_PASSWORD`.
2. **Database**, either:
   - Docker: `docker compose -f java/persistence/docker-compose.yml up -d` (creates the database and loads everything on first start), or
   - Local PostgreSQL: create the user and database once, then load the tables:
     ```sql
     CREATE ROLE itsm_user LOGIN PASSWORD 'your-password';
     CREATE DATABASE irctc_itsm OWNER itsm_user;
     ```
     ```sh
     npm run db:setup
     ```
3. **Install and build**:
   ```sh
   npm ci
   npm run service:build
   ```
4. **Start the three processes**, each in its own terminal:
   ```sh
   npm run service    # Java incident service on 127.0.0.1:8081
   npm run api        # Node API on 127.0.0.1:3001
   npm run dev        # React UI; open the URL Vite prints
   ```

On first start in development the API gives every seeded account the demo password from `backend/seed/demoUsers.ts` (or `DEMO_PASSWORD`). The login page lists the demo accounts.

## Demo workflows

1. **Report and prioritise.** Sign in as `support1@demo.local` and report a Tatkal booking or UPI payment failure with high impact and urgency. It is classified P1 with the reason shown, similar open incidents are flagged, and the manager gets in-app and email notifications.
2. **Assign, investigate, resolve, close.** As `admin1@demo.local`, assign with the skill- or load-based strategy. As the assigned technician, acknowledge, start, add notes and resolve with a root cause. As the employee, confirm the fix and rate it. As the manager, close it. The history shows every step with its before and after state.
3. **SLA monitoring and escalation.** Leave a P1/P2 unacknowledged: the SLA monitor records the violation and escalates to the IT manager (see Notifications and Management → Email outbox).

## Checks

```sh
npm test                        # Node tests: priority preview, auth, role checks, forwarding
npm run build                   # TypeScript check + production build
mvn -B -f java/pom.xml verify   # builds domain, persistence and service
mvn -f java/domain/pom.xml test-compile exec:java -Dexec.mainClass=com.railway.itsm.DomainModelChecks -Dexec.classpathScope=test   # 38 domain checks
```

## Project layout

```text
src/                    React UI: pages/, components/, auth.tsx (session), data/api.ts (HTTP client)
shared/domain.ts        JSON contract shared by UI and API; priority preview
backend/                Node API: auth/, routes/ (incidents forwarded, planned 501s), http/incidentService.ts, db/
java/domain/            Domain model and rules: Incident lifecycle, strategies, events
java/persistence/       PostgreSQL schema, seed, integration migration, JDBC repositories
java/service/           Incident service: adapters between domain and persistence, HTTP API, notifications, SLA monitor
scripts/                db:setup and service launcher
docs/                   Architecture, API reference, roadmap
tests/                  Node tests
```

## Boundaries

Demo data only; do not enter real passenger or operational data. Email is simulated (stored in an outbox and printed by the service). Admin editing of users, services, categories and SLA policies is not built yet (those endpoints return 501). The API keeps sessions in memory, so restarting it signs everyone out.
