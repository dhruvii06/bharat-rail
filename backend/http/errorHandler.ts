import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, BadRequestError, NotFoundError } from '../errors.ts';

// Unknown routes become a normal 404 in the agreed error format.
export const notFound: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`No endpoint matches ${req.method} ${req.path}.`));
};

// Maps any error to the JSON shape in docs/API.md. Never leaks stack traces.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const error = toAppError(err);
  if (error) {
    res.status(error.status).json(error.toJSON());
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on the server. Try again.' } });
};

// body-parser raises plain errors with `type` and `status`; translate the ones clients can cause.
function toAppError(err: unknown): AppError | undefined {
  if (err instanceof AppError) return err;
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.parse.failed') return new BadRequestError('Request body is not valid JSON.');
  if (e?.type === 'entity.too.large') return new PayloadTooLargeError();
  return undefined;
}

class PayloadTooLargeError extends AppError {
  readonly status = 413;
  readonly code = 'PAYLOAD_TOO_LARGE';
  constructor() { super('Request body is too large.'); }
}
