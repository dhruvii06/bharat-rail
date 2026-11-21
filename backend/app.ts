import express, { type Express } from 'express';
import { AuthService } from './auth/AuthService.ts';
import { requireAuth } from './auth/middleware.ts';
import { errorHandler, notFound } from './http/errorHandler.ts';
import type { SessionRepository, UserRepository } from './repositories/types.ts';
import { authRoutes } from './routes/auth.ts';
import { plannedRoutes } from './routes/planned.ts';

export interface AppDeps {
  users: UserRepository;
  sessions: SessionRepository;
  auth?: AuthService;
}

// Builds the Express app from its dependencies (composition root lives in server.ts).
// Tests call this directly with in-memory repositories.
export function createApp(deps: AppDeps): Express {
  const auth = deps.auth ?? new AuthService(deps.users, deps.sessions);
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
  api.use(requireAuth(auth), plannedRoutes());

  app.use('/api/v1', api);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
