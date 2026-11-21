import { Router } from 'express';
import type { AuthService } from '../auth/AuthService.ts';
import { authOf, requireAuth } from '../auth/middleware.ts';
import { BodyValidator } from '../http/validate.ts';

export function authRoutes(auth: AuthService): Router {
  const router = Router();

  // POST /auth/register  {name, email, password} -> 201 {user}
  router.post('/register', async (req, res) => {
    const v = new BodyValidator(req.body);
    const name = v.string('name', { min: 2, max: 80 });
    const email = v.email('email');
    const password = v.password('password');
    v.done();
    const user = await auth.register({ name, email, password });
    res.status(201).json({ user });
  });

  // POST /auth/login  {email, password} -> 200 {token, expiresAt, user}
  router.post('/login', async (req, res) => {
    const v = new BodyValidator(req.body);
    const email = v.email('email');
    const password = v.string('password', { max: 128, trim: false });
    v.done();
    res.json(await auth.login(email, password));
  });

  // POST /auth/logout -> 204. Revokes the current token.
  router.post('/logout', requireAuth(auth), async (_req, res) => {
    await auth.logout(authOf(res).tokenHash);
    res.status(204).end();
  });

  // GET /auth/me -> 200 {user}
  router.get('/me', requireAuth(auth), (_req, res) => {
    res.json({ user: authOf(res).user });
  });

  return router;
}
