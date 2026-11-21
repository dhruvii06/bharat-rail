import { ValidationError, type FieldErrors } from '../errors.ts';

// Small runtime validator. TypeScript types vanish at runtime, so every request body is checked here.
// Collects all field problems first, then throws one ValidationError (HTTP 422).
export class BodyValidator {
  private readonly body: Record<string, unknown>;
  private readonly errors: FieldErrors = {};

  constructor(body: unknown) {
    this.body = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  }

  string(field: string, opts: { min?: number; max?: number; trim?: boolean } = {}): string {
    const { min = 1, max = 200, trim = true } = opts;
    const raw = this.body[field];
    if (typeof raw !== 'string') { this.errors[field] = 'Required.'; return ''; }
    const value = trim ? raw.trim() : raw;
    if (value.length < min) this.errors[field] = min <= 1 ? 'Required.' : `Use at least ${min} characters.`;
    else if (value.length > max) this.errors[field] = `Use at most ${max} characters.`;
    return value;
  }

  email(field: string): string {
    const value = this.string(field, { max: 254 }).toLowerCase();
    if (!this.errors[field] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) this.errors[field] = 'Enter a valid email address.';
    return value;
  }

  password(field: string): string {
    const value = this.string(field, { min: 8, max: 128, trim: false });
    if (!this.errors[field] && (!/[A-Za-z]/.test(value) || !/\d/.test(value))) this.errors[field] = 'Use letters and at least one number.';
    return value;
  }

  /** Absent or empty → undefined; otherwise checked like string(). */
  optionalString(field: string, opts: { max?: number } = {}): string | undefined {
    const raw = this.body[field];
    if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return undefined;
    return this.string(field, { min: 1, max: opts.max ?? 200 });
  }

  boolean(field: string): boolean {
    const raw = this.body[field];
    if (typeof raw !== 'boolean') { this.errors[field] = 'Must be true or false.'; return false; }
    return raw;
  }

  done(): void {
    if (Object.keys(this.errors).length) throw new ValidationError({ ...this.errors });
  }
}
