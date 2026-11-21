// Application error hierarchy. Every error the API reports on purpose extends AppError,
// so the error middleware can map them to HTTP responses polymorphically (no instanceof chains).
// Domain errors (Student 3) should extend one of these classes, e.g.
//   class InvalidTransitionError extends ConflictError { ... }
// Note: backend code runs with Node's type stripping, so avoid enums, namespaces
// and constructor parameter properties (`constructor(private x)`).

export type FieldErrors = Record<string, string>;

export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;
  readonly fieldErrors?: FieldErrors;

  constructor(message: string, fieldErrors?: FieldErrors) {
    super(message);
    this.name = new.target.name;
    this.fieldErrors = fieldErrors;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, ...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}) } };
  }
}

export class BadRequestError extends AppError {
  readonly status = 400;
  readonly code: string = 'BAD_REQUEST';
}

export class UnauthenticatedError extends AppError {
  readonly status = 401;
  readonly code: string = 'UNAUTHENTICATED';
  constructor(message = 'Sign in to continue.') { super(message); }
}

export class InvalidCredentialsError extends UnauthenticatedError {
  readonly code = 'INVALID_CREDENTIALS';
  constructor() { super('Email or password is incorrect.'); }
}

export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly code: string = 'FORBIDDEN';
  constructor(message = 'You do not have permission to do this.') { super(message); }
}

export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code: string = 'NOT_FOUND';
}

export class ConflictError extends AppError {
  readonly status = 409;
  readonly code: string = 'CONFLICT';
}

export class ValidationError extends AppError {
  readonly status = 422;
  readonly code: string = 'VALIDATION_FAILED';
  constructor(fieldErrors: FieldErrors, message = 'Some fields need attention.') { super(message, fieldErrors); }
}

export class TooManyRequestsError extends AppError {
  readonly status = 429;
  readonly code: string = 'TOO_MANY_REQUESTS';
}

export class NotImplementedError extends AppError {
  readonly status = 501;
  readonly code: string = 'NOT_IMPLEMENTED';
  constructor(message = 'This endpoint is planned but not built yet. See docs/API.md.') { super(message); }
}

export class ServiceUnavailableError extends AppError {
  readonly status = 503;
  readonly code: string = 'SERVICE_UNAVAILABLE';
}
