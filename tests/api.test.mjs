// API integration tests: real Express app on a random port, in-memory repositories.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../backend/app.ts';
import { AuthService } from '../backend/auth/AuthService.ts';
import { hashPassword, verifyPassword } from '../backend/auth/passwords.ts';
import { InMemorySessionRepository, InMemoryUserRepository } from '../backend/repositories/memory.ts';

const PASSWORD = 'TestPass123';
let server, base, clock;

async function call(method, path, { body, token, raw } = {}) {
  const headers = {};
  if (body !== undefined || raw !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}
const login = async email => (await call('POST', '/auth/login', { body: { email, password: PASSWORD } })).body.token;

before(async () => {
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const passwordHash = await hashPassword(PASSWORD);
  for (const [id, role, email] of [['e1', 'Employee', 'emp@test.local'], ['t1', 'Technician', 'tech@test.local'], ['m1', 'Manager', 'mgr@test.local'], ['x1', 'Employee', 'gone@test.local']]) {
    await users.create({ id, name: id, email, role, passwordHash, isTeamLead: false, active: id !== 'x1' });
  }
  clock = { now: new Date('2026-11-22T09:00:00Z') };
  const auth = new AuthService(users, sessions, { now: () => clock.now, maxFailedLogins: 3 });
  server = createApp({ users, sessions, auth }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
});
after(() => server.close());

describe('passwords', () => {
  test('hash verifies only the original password', async () => {
    const h = await hashPassword('Secret123');
    assert.match(h, /^scrypt\$/);
    assert.equal(await verifyPassword('Secret123', h), true);
    assert.equal(await verifyPassword('secret123', h), false);
  });
  test('malformed stored hash is rejected, not thrown', async () => assert.equal(await verifyPassword('x', 'plain-text'), false));
});

describe('auth API', () => {
  test('health check is public', async () => assert.equal((await call('GET', '/health')).status, 200));

  test('employee can register and the response hides the password hash', async () => {
    const r = await call('POST', '/auth/register', { body: { name: 'New Person', email: 'New@Test.local', password: 'Passw0rdOK' } });
    assert.equal(r.status, 201);
    assert.deepEqual(Object.keys(r.body.user).sort(), ['email', 'id', 'isTeamLead', 'name', 'role']);
    assert.equal(r.body.user.role, 'Employee');
    assert.equal(r.body.user.email, 'new@test.local');
  });

  test('registration ignores a client-supplied role', async () => {
    const r = await call('POST', '/auth/register', { body: { name: 'Sneaky', email: 'sneaky@test.local', password: 'Passw0rdOK', role: 'Manager' } });
    assert.equal(r.body.user.role, 'Employee');
  });

  test('duplicate email returns 409', async () => {
    const r = await call('POST', '/auth/register', { body: { name: 'Dup', email: 'emp@test.local', password: 'Passw0rdOK' } });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'CONFLICT');
  });

  test('invalid registration returns 422 with every field error', async () => {
    const r = await call('POST', '/auth/register', { body: { name: 'A', email: 'not-an-email', password: 'short' } });
    assert.equal(r.status, 422);
    assert.deepEqual(Object.keys(r.body.error.fieldErrors).sort(), ['email', 'name', 'password']);
  });

  test('password needs letters and a number', async () => {
    const r = await call('POST', '/auth/register', { body: { name: 'Bob', email: 'bob@test.local', password: 'onlyletters' } });
    assert.equal(r.body.error.fieldErrors.password, 'Use letters and at least one number.');
  });

  test('malformed JSON returns 400', async () => {
    const r = await call('POST', '/auth/login', { raw: '{"email":' });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'BAD_REQUEST');
  });

  test('wrong password and unknown email give the same 401', async () => {
    const a = await call('POST', '/auth/login', { body: { email: 'tech@test.local', password: 'Wrong1234' } });
    const b = await call('POST', '/auth/login', { body: { email: 'nobody@test.local', password: 'Wrong1234' } });
    assert.equal(a.status, 401);
    assert.deepEqual(a.body, b.body);
  });

  test('deactivated account cannot sign in', async () => {
    assert.equal((await call('POST', '/auth/login', { body: { email: 'gone@test.local', password: PASSWORD } })).status, 401);
  });

  test('login, me and logout round trip', async () => {
    const r = await call('POST', '/auth/login', { body: { email: 'EMP@test.local', password: PASSWORD } });
    assert.equal(r.status, 200);
    assert.equal(typeof r.body.token, 'string');
    assert.equal(r.body.expiresAt, '2026-11-22T17:00:00.000Z');
    const me = await call('GET', '/auth/me', { token: r.body.token });
    assert.equal(me.body.user.id, 'e1');
    assert.equal((await call('POST', '/auth/logout', { token: r.body.token })).status, 204);
    assert.equal((await call('GET', '/auth/me', { token: r.body.token })).status, 401);
  });

  test('missing or forged token returns 401', async () => {
    assert.equal((await call('GET', '/auth/me')).status, 401);
    assert.equal((await call('GET', '/auth/me', { token: 'forged' })).status, 401);
  });

  test('session expires after 8 hours', async () => {
    const token = await login('tech@test.local');
    clock.now = new Date('2026-11-22T17:00:01Z');
    try {
      const r = await call('GET', '/auth/me', { token });
      assert.equal(r.status, 401);
      assert.match(r.body.error.message, /expired/);
    } finally { clock.now = new Date('2026-11-22T09:00:00Z'); }
  });

  test('account locks after repeated failures, even with the right password', async () => {
    for (let i = 0; i < 3; i++) await call('POST', '/auth/login', { body: { email: 'mgr@test.local', password: 'Wrong1234' } });
    const r = await call('POST', '/auth/login', { body: { email: 'mgr@test.local', password: PASSWORD } });
    assert.equal(r.status, 429);
    clock.now = new Date('2026-11-22T09:16:00Z');
    try { assert.equal((await call('POST', '/auth/login', { body: { email: 'mgr@test.local', password: PASSWORD } })).status, 200); }
    finally { clock.now = new Date('2026-11-22T09:00:00Z'); }
  });
});

describe('authorization on planned endpoints', () => {
  test('planned endpoint needs sign-in', async () => assert.equal((await call('GET', '/incidents')).status, 401));

  test('employee cannot reach manager-only reports', async () => {
    const r = await call('GET', '/reports/overview', { token: await login('emp@test.local') });
    assert.equal(r.status, 403);
    assert.equal(r.body.error.code, 'FORBIDDEN');
  });

  test('technician cannot assign incidents', async () => {
    assert.equal((await call('POST', '/incidents/INC1/assignment', { token: await login('tech@test.local'), body: {} })).status, 403);
  });

  test('allowed role gets 501 until the endpoint is built', async () => {
    const r = await call('GET', '/reports/overview', { token: await login('mgr@test.local') });
    assert.equal(r.status, 501);
    assert.equal(r.body.error.code, 'NOT_IMPLEMENTED');
  });

  test('unknown path outside the API returns 404 JSON', async () => {
    const res = await fetch(base.replace('/api/v1', '/nope'));
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, 'NOT_FOUND');
  });

  test('responses carry security headers and no Express banner', async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});
