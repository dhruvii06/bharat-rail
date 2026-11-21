// API integration tests: real Express app on a random port, in-memory repositories.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../backend/app.ts';
import { AuthService } from '../backend/auth/AuthService.ts';
import { hashPassword, verifyPassword } from '../backend/auth/passwords.ts';
import { InMemorySessionRepository, InMemoryUserRepository } from '../backend/repositories/memory.ts';
import { IncidentServiceClient } from '../backend/http/incidentService.ts';
import { createServer } from 'node:http';

const PASSWORD = 'TestPass123';
let server, base, clock, fakeService, lastForwarded;

async function call(method, path, { body, token, raw } = {}) {
  const headers = {};
  if (body !== undefined || raw !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}
const login = async (email, password = PASSWORD) => (await call('POST', '/auth/login', { body: { email, password } })).body.token;

before(async () => {
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const passwordHash = await hashPassword(PASSWORD);
  for (const [id, role, email] of [['e1', 'Employee', 'emp@test.local'], ['t1', 'Technician', 'tech@test.local'], ['m1', 'Manager', 'mgr@test.local'], ['x1', 'Employee', 'gone@test.local']]) {
    await users.create({ id, name: id, email, role, passwordHash, isTeamLead: false, active: id !== 'x1' });
  }
  clock = { now: new Date('2026-11-22T09:00:00Z') };
  const auth = new AuthService(users, sessions, { now: () => clock.now, maxFailedLogins: 3 });
  // Fake Java incident service: records what Node forwards and echoes it back.
  fakeService = createServer((req, res) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      lastForwarded = { method: req.method, url: req.url, headers: req.headers, body: raw ? JSON.parse(raw) : undefined };
      if (req.url.startsWith('/incidents/NOPE')) { res.writeHead(409, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'INVALID_TRANSITION', message: 'Not allowed now.' } })); return; }
      res.writeHead(req.method === 'POST' ? 201 : 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ echoed: true, url: req.url }));
    });
  }).listen(0, '127.0.0.1');
  await new Promise(r => fakeService.once('listening', r));
  const incidentService = new IncidentServiceClient(`http://127.0.0.1:${fakeService.address().port}`, 'test-token');
  server = createApp({ users, sessions, auth, incidentService }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
});
after(() => { server.close(); fakeService.close(); });

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

  test('self-registration creates a Passenger and hides the password hash', async () => {
    const r = await call('POST', '/auth/register', { body: { name: 'New Person', email: 'New@Test.local', password: 'Passw0rdOK' } });
    assert.equal(r.status, 201);
    assert.deepEqual(Object.keys(r.body.user).sort(), ['email', 'id', 'isTeamLead', 'mustChangePassword', 'name', 'role']);
    assert.equal(r.body.user.role, 'Passenger');
    assert.equal(r.body.user.mustChangePassword, false);
    assert.equal(r.body.user.email, 'new@test.local');
  });

  test('registration ignores a client-supplied role (cannot self-register as staff)', async () => {
    const r = await call('POST', '/auth/register', { body: { name: 'Sneaky', email: 'sneaky@test.local', password: 'Passw0rdOK', role: 'Employee' } });
    assert.equal(r.body.user.role, 'Passenger');
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

  test('allowed role gets 501 on endpoints not built yet', async () => {
    const r = await call('GET', '/audit', { token: await login('mgr@test.local') });
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

describe('forwarding to the incident service', () => {
  test('forwards path, query, signed-in user, role and internal token', async () => {
    const r = await call('GET', '/reports/overview?from=2026-11-01', { token: await login('mgr@test.local') });
    assert.equal(r.status, 200);
    assert.equal(lastForwarded.url, '/reports/overview?from=2026-11-01');
    assert.equal(lastForwarded.headers['x-actor-id'], 'm1');
    assert.equal(lastForwarded.headers['x-actor-role'], 'ADMIN');
    assert.equal(lastForwarded.headers['x-internal-token'], 'test-token');
  });

  test('forwards the JSON body and passes the status through', async () => {
    const body = { title: 'UPI payment failing', serviceId: 2 };
    const r = await call('POST', '/incidents', { token: await login('emp@test.local'), body });
    assert.equal(r.status, 201);
    assert.deepEqual(lastForwarded.body, body);
    assert.equal(lastForwarded.headers['x-actor-role'], 'EMPLOYEE');
  });

  test('a role the client sends is never forwarded; the session decides', async () => {
    await call('POST', '/incidents/INC-1/notes', { token: await login('tech@test.local'), body: { text: 'hi', role: 'Manager' } });
    assert.equal(lastForwarded.headers['x-actor-role'], 'TECHNICIAN');
    assert.equal(lastForwarded.headers['x-actor-id'], 't1');
  });

  test('domain rule errors from the service reach the client unchanged', async () => {
    const r = await call('POST', '/incidents/NOPE/transitions', { token: await login('mgr@test.local'), body: { action: 'CLOSE' } });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'INVALID_TRANSITION');
  });

  test('the role gate runs before anything is forwarded', async () => {
    lastForwarded = undefined;
    const r = await call('POST', '/incidents', { token: await login('tech@test.local'), body: {} });
    assert.equal(r.status, 403);
    assert.equal(lastForwarded, undefined);
  });

  test('service down returns 503 with a clear message', async () => {
    const users = new InMemoryUserRepository();
    const sessions = new InMemorySessionRepository();
    await users.create({ id: 'm9', name: 'm9', email: 'm9@test.local', role: 'Manager', passwordHash: await hashPassword(PASSWORD), isTeamLead: false, active: true });
    const down = createApp({ users, sessions, incidentService: new IncidentServiceClient('http://127.0.0.1:9', 't') }).listen(0, '127.0.0.1');
    await new Promise(r => down.once('listening', r));
    try {
      const url = `http://127.0.0.1:${down.address().port}/api/v1`;
      const token = (await (await fetch(`${url}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'm9@test.local', password: PASSWORD }) })).json()).token;
      const res = await fetch(`${url}/incidents`, { headers: { authorization: `Bearer ${token}` } });
      assert.equal(res.status, 503);
      assert.match((await res.json()).error.message, /incident service is not running/);
    } finally { down.close(); }
  });
});

describe('account administration (IT manager)', () => {
  test('manager lists accounts without password hashes', async () => {
    const r = await call('GET', '/admin/users', { token: await login('mgr@test.local') });
    assert.equal(r.status, 200);
    const emp = r.body.find(u => u.email === 'emp@test.local');
    assert.equal(emp.active, true);
    assert.equal('passwordHash' in emp, false);
  });

  test('employee and technician cannot manage accounts', async () => {
    assert.equal((await call('GET', '/admin/users', { token: await login('emp@test.local') })).status, 403);
    assert.equal((await call('POST', '/admin/users', { token: await login('tech@test.local'), body: {} })).status, 403);
  });

  test('creating a technician saves the skill profile through the incident service', async () => {
    const r = await call('POST', '/admin/users', { token: await login('mgr@test.local'),
      body: { name: 'New Tech', email: 'newtech@test.local', password: 'NewTech123', role: 'Technician', department: 'Payments', skill: 'PAYMENT', experienceYears: 3 } });
    assert.equal(r.status, 201);
    assert.equal(r.body.user.role, 'Technician');
    assert.equal(r.body.warning, undefined);
    assert.equal(lastForwarded.method, 'PUT');
    assert.equal(lastForwarded.url, `/admin/technicians/${r.body.user.id}`);
    assert.deepEqual(lastForwarded.body, { skill: 'PAYMENT', experienceYears: 3, available: true });
    assert.equal((await call('POST', '/auth/login', { body: { email: 'newtech@test.local', password: 'NewTech123' } })).status, 200);
  });

  test('account input is validated', async () => {
    const token = await login('mgr@test.local');
    let r = await call('POST', '/admin/users', { token, body: { name: 'X Tech', email: 'x@test.local', password: 'Passw0rdOK', role: 'Technician' } });
    assert.equal(r.status, 422);
    assert.ok(r.body.error.fieldErrors.skill);
    r = await call('POST', '/admin/users', { token, body: { name: 'Boss', email: 'boss@test.local', password: 'Passw0rdOK', role: 'Admin' } });
    assert.ok(r.body.error.fieldErrors.role);
    r = await call('POST', '/admin/users', { token, body: { name: 'Weak', email: 'weak@test.local', password: 'short', role: 'Employee' } });
    assert.ok(r.body.error.fieldErrors.password);
    r = await call('POST', '/admin/users', { token, body: { name: 'Dup', email: 'emp@test.local', password: 'Passw0rdOK', role: 'Employee' } });
    assert.equal(r.status, 409);
  });

  test('a deactivated account is signed out and cannot sign in again', async () => {
    const mgr = await login('mgr@test.local');
    await call('POST', '/admin/users', { token: mgr, body: { name: 'Leaver', email: 'leaver@test.local', password: 'Leaver123', role: 'Employee' } });
    const leaverToken = (await call('POST', '/auth/login', { body: { email: 'leaver@test.local', password: 'Leaver123' } })).body.token;
    const id = (await call('GET', '/admin/users', { token: mgr })).body.find(u => u.email === 'leaver@test.local').id;
    const r = await call('PATCH', `/admin/users/${id}`, { token: mgr, body: { active: false } });
    assert.equal(r.body.user.active, false);
    assert.equal((await call('GET', '/auth/me', { token: leaverToken })).status, 401);
    assert.equal((await call('POST', '/auth/login', { body: { email: 'leaver@test.local', password: 'Leaver123' } })).status, 401);
    await call('PATCH', `/admin/users/${id}`, { token: mgr, body: { active: true } });
    assert.equal((await call('POST', '/auth/login', { body: { email: 'leaver@test.local', password: 'Leaver123' } })).status, 200);
  });

  test('manager cannot deactivate their own account; unknown users are 404', async () => {
    const mgr = await login('mgr@test.local');
    assert.equal((await call('PATCH', '/admin/users/m1', { token: mgr, body: { active: false } })).status, 409);
    assert.equal((await call('PATCH', '/admin/users/nobody', { token: mgr, body: { name: 'Nobody' } })).status, 404);
  });
});

describe('role gates on admin settings and the information step', () => {
  test('only the technician role can ask for information; only employees answer', async () => {
    assert.equal((await call('POST', '/incidents/INC-1/info-request', { token: await login('emp@test.local'), body: { question: 'x' } })).status, 403);
    assert.equal((await call('POST', '/incidents/INC-1/info-request', { token: await login('tech@test.local'), body: { question: 'Which UPI app?' } })).status, 201);
    assert.equal(lastForwarded.url, '/incidents/INC-1/info-request');
    assert.equal((await call('POST', '/incidents/INC-1/info-response', { token: await login('tech@test.local'), body: { answer: 'x' } })).status, 403);
    assert.equal((await call('POST', '/incidents/INC-1/info-response', { token: await login('emp@test.local'), body: { answer: 'PhonePe' } })).status, 201);
  });

  test('service, SLA, category and settings administration is manager-only and forwarded', async () => {
    const tech = await login('tech@test.local'), mgr = await login('mgr@test.local');
    for (const [method, path] of [['POST', '/admin/services'], ['PUT', '/admin/sla-policies/P1'], ['PATCH', '/admin/categories/PAYMENT'], ['PUT', '/admin/settings']]) {
      assert.equal((await call(method, path, { token: tech, body: {} })).status, 403, `${method} ${path} as technician`);
      await call(method, path, { token: mgr, body: { x: 1 } });
      assert.equal(lastForwarded.url, path);
      assert.equal(lastForwarded.headers['x-actor-role'], 'ADMIN');
    }
  });
});

describe('passengers and first-login password change', () => {
  test('a passenger can report and answer, but not use staff screens', async () => {
    await call('POST', '/auth/register', { body: { name: 'Rider One', email: 'rider@test.local', password: 'Rider2026x' } });
    const token = await login('rider@test.local', 'Rider2026x');
    const r = await call('POST', '/incidents', { token, body: { title: 'App crashes on UPI', serviceId: 2 } });
    assert.equal(r.status, 201);
    assert.equal(lastForwarded.headers['x-actor-role'], 'PASSENGER');
    assert.equal((await call('POST', '/incidents/INC-1/info-response', { token, body: { answer: 'Android 14' } })).status, 201);
    assert.equal((await call('GET', '/technicians', { token })).status, 403);
    assert.equal((await call('GET', '/admin/users', { token })).status, 403);
    assert.equal((await call('POST', '/incidents/INC-1/info-request', { token, body: { question: 'x' } })).status, 403);
  });

  test('an admin-created account must change its temporary password before anything else', async () => {
    const mgr = await login('mgr@test.local');
    const created = await call('POST', '/admin/users', { token: mgr, body: { name: 'New Clerk', email: 'clerk@test.local', password: 'Temp2026x', role: 'Employee' } });
    assert.equal(created.body.user.mustChangePassword, true);
    const first = await call('POST', '/auth/login', { body: { email: 'clerk@test.local', password: 'Temp2026x' } });
    assert.equal(first.body.user.mustChangePassword, true);
    const token = first.body.token;
    const blocked = await call('GET', '/incidents', { token });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, 'PASSWORD_CHANGE_REQUIRED');
    assert.equal((await call('GET', '/auth/me', { token })).status, 200);
    let r = await call('POST', '/auth/change-password', { token, body: { currentPassword: 'wrong-one', newPassword: 'MyOwn2026x' } });
    assert.equal(r.status, 422);
    assert.ok(r.body.error.fieldErrors.currentPassword);
    r = await call('POST', '/auth/change-password', { token, body: { currentPassword: 'Temp2026x', newPassword: 'Temp2026x' } });
    assert.ok(r.body.error.fieldErrors.newPassword);
    r = await call('POST', '/auth/change-password', { token, body: { currentPassword: 'Temp2026x', newPassword: 'short' } });
    assert.ok(r.body.error.fieldErrors.newPassword);
    r = await call('POST', '/auth/change-password', { token, body: { currentPassword: 'Temp2026x', newPassword: 'MyOwn2026x' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.user.mustChangePassword, false);
    assert.equal((await call('GET', '/incidents', { token })).status, 200);
    assert.equal((await call('POST', '/auth/login', { body: { email: 'clerk@test.local', password: 'Temp2026x' } })).status, 401);
    assert.equal((await call('POST', '/auth/login', { body: { email: 'clerk@test.local', password: 'MyOwn2026x' } })).status, 200);
  });

  test('change-password needs a signed-in user', async () => {
    assert.equal((await call('POST', '/auth/change-password', { body: { currentPassword: 'a', newPassword: 'Passw0rdOK' } })).status, 401);
  });
});
