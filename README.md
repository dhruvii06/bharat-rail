# oop-irctc

Intelligent IT Service Management & Incident Resolution System, adapted to an IRCTC incident scenario for the CS F213 / MAC F212 OOP course. Independent student prototype; no live IRCTC integration.

## Start

Use Node.js 22.16+ and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. `npm run build` checks TypeScript and creates `dist/`; `npm test` runs domain and API tests. `npm run api` starts the backend on port 3001 (login and registration work; incident endpoints return 501 until Phase 2). With both running, Vite forwards `/api` to the backend. See [API](docs/API.md) for demo accounts.

## Demonstrate the basic flow

1. Employee: report an Application incident for Payments with factors 3/3/3. Inspect calculated P1 and deadlines.
2. Manager: open it and move to ASSIGNED. Default assignment selects a matching available technician.
3. Technician: acknowledge, start investigation, enter resolution details and resolve.
4. Employee: inspect the resolution and verify it.
5. Manager: close it and review its complete demo transition history.

The preloaded Application incident supports the same walkthrough. Database, Network and Security incidents assign to `tech-infra`, which is not the selectable technician in this initial demo.

## Project layout

```text
src/
  App.tsx               Routes and basic page structure
  styles.css            Replaceable wireframe styling
  data/api.ts           API interface, mock adapter, assignment strategies
shared/domain.ts        Incident contracts, priority policy and transitions
backend/
  server.ts             Composition root: picks repositories, seeds demo users, starts Express
  app.ts                Express app: security headers, JSON parsing, routes, error handling
  errors.ts             AppError hierarchy mapped to HTTP status codes
  auth/                 Password hashing, sessions, login lockout, role guards
  repositories/         Repository interfaces and in-memory versions
  routes/               Auth routes and role-guarded planned endpoints
docs/                   Architecture, API proposal and delivery checklist
tests/                  Business-rule tests
.github/workflows/      Automated tests and production build
```

Frontend uses React, TypeScript, React Router and Vite. Business rules and the data adapter are separate from rendering so the UI can change next. The backend is Node.js with Express 5 and TypeScript, run through Node's built-in type stripping. Storage is in memory for now; SQLite is planned behind the repository interfaces.

## Prototype boundaries

Browser localStorage is the demo persistence layer. The role selector is a presentation aid, not authentication or security. Data is specific to this browser and origin. Clearing site storage resets the demo; do not enter real passenger or operational data. No passwords are collected. No notifications are actually sent.

The environment example reserves an API URL; changing it alone does not enable API mode. Implement an HTTP adapter for `IncidentApi` and replace its exported instance when the agreed endpoints exist.

This is an initial frontend foundation, not the completed course MVP. See [architecture](docs/ARCHITECTURE.md), [API proposal](docs/API.md) and [remaining requirements](docs/ROADMAP.md). The final visual design is intentionally pending.

## GitHub setup

Create a private empty GitHub repository named `oop-irctc`, then use the repo URL GitHub provides:

```sh
git remote add origin https://github.com/YOUR_USERNAME/oop-irctc.git
git push -u origin main
```

Only do this after making the initial commit if using an uncommitted copy. The supplied local repository already has an initial commit when setup succeeds. Do not upload node_modules, .env or dist.

## Java team contributions

The two ZIP submissions are now source modules under [java/](java/README.md): domain OOP and PostgreSQL persistence. See that guide for Java 21 build, database setup, validation and the remaining API/model adapter boundary. These modules are not yet connected to the Express web API.
