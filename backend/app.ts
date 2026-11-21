import express, { type Express } from 'express';
import { AuthService } from './auth/AuthService.ts';
import { requireAuth, requireCurrentPassword } from './auth/middleware.ts';
import { errorHandler, notFound } from './http/errorHandler.ts';
import { IncidentServiceClient } from './http/incidentService.ts';
import type { SessionRepository, UserDirectory, UserRepository } from './repositories/types.ts';
import { adminUserRoutes } from './routes/adminUsers.ts';
import { authRoutes } from './routes/auth.ts';
import { incidentRoutes } from './routes/incidents.ts';
import { plannedRoutes } from './routes/planned.ts';

export const DEV_INTERNAL_TOKEN = 'dev-internal-token';

export interface AppDeps {
  users: UserRepository & UserDirectory;
  sessions: SessionRepository;
  auth?: AuthService;
  incidentService?: IncidentServiceClient;
}

// Builds the Express app from its dependencies (composition root lives in server.ts).
// Tests call this directly with in-memory repositories and a fake incident service.
export function createApp(deps: AppDeps): Express {
  const auth = deps.auth ?? new AuthService(deps.users, deps.sessions);
  const incidents = deps.incidentService ?? new IncidentServiceClient(
    process.env.ITSM_SERVICE_URL || 'http://127.0.0.1:8081', process.env.ITSM_INTERNAL_TOKEN || DEV_INTERNAL_TOKEN);
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use((_req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    next();
  });
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  api.get('/health', (_req, res) => { res.json({ status: 'ok', time: new Date().toISOString() }); });
  api.use('/auth', authRoutes(auth));
  api.use(requireAuth(auth), requireCurrentPassword, adminUserRoutes(deps.users, deps.users, incidents), incidentRoutes(incidents), plannedRoutes());

  app.use('/api/v1', api);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
