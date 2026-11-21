import type { RequestHandler } from 'express';
import type { Role } from '../../shared/domain.ts';
import { authOf } from '../auth/middleware.ts';
import { ServiceUnavailableError } from '../errors.ts';

// Client for the Java incident service (java/service). Node authenticates the user; the Java
// service applies the domain rules and talks to PostgreSQL. Each forwarded request carries the
// signed-in user's id and role, plus a shared internal token so only this API can call the service.

const serviceRole: Record<Role, string> = { Employee: 'EMPLOYEE', Technician: 'TECHNICIAN', Manager: 'ADMIN' };

export interface ServiceResponse { status: number; body: unknown }

export class IncidentServiceClient {
  readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  async forward(method: string, pathAndQuery: string, actor: { id: string; role: Role }, body?: unknown): Promise<ServiceResponse> {
    let res: Response;
    try {
      res = await fetch(this.baseUrl + pathAndQuery, {
        method,
        headers: {
          'content-type': 'application/json',
          'x-internal-token': this.token,
          'x-actor-id': actor.id,
          'x-actor-role': serviceRole[actor.role]
        },
        body: method === 'GET' || body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000)
      });
    } catch {
      throw new ServiceUnavailableError('The incident service is not running. Start it with `npm run service`.');
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined };
  }

  /** Express handler that forwards the current request (path after /api/v1, query and body). */
  proxy(): RequestHandler {
    return async (req, res) => {
      const { user } = authOf(res);
      const result = await this.forward(req.method, req.url, { id: user.id, role: user.role }, req.body);
      if (result.body === undefined) res.status(result.status).end();
      else res.status(result.status).json(result.body);
    };
  }
}
