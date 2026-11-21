import type { RequestHandler, Response } from 'express';
import type { Role } from '../../shared/domain.ts';
import { ForbiddenError, UnauthenticatedError } from '../errors.ts';
import type { AuthContext, AuthService } from './AuthService.ts';

// The server decides who the caller is from the session token, never from a role sent by the client.

export function requireAuth(auth: AuthService): RequestHandler {
  return async (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    res.locals.auth = await auth.authenticate(match?.[1]);
    next();
  };
}

/** Use after requireAuth. Example: router.post('/assignment', requireRole('Manager'), handler) */
export function requireRole(...roles: Role[]): RequestHandler {
  return (_req, res, next) => {
    const { user } = authOf(res);
    if (!roles.includes(user.role)) throw new ForbiddenError(`Only ${roles.join(' or ')} accounts can do this.`);
    next();
  };
}

/** The signed-in user for this request. Throws 401 if requireAuth did not run. */
export function authOf(res: Response): AuthContext {
  const ctx = res.locals.auth as AuthContext | undefined;
  if (!ctx) throw new UnauthenticatedError();
  return ctx;
}
