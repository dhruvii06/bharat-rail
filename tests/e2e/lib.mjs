// Shared helpers for the end-to-end suites. They call the running Node API, which forwards to the
// Java service and PostgreSQL, so they test the whole stack. Run them with: npm run test:e2e
import { DEFAULT_DEMO_PASSWORD } from '../../backend/seed/demoUsers.ts';

export const base = process.env.E2E_API ?? 'http://127.0.0.1:3001/api/v1';
export const demoPassword = process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD;
/** Makes names and emails unique so the suites can run again on the same database. */
export const runId = Date.now().toString(36);

export async function j(method, path, token, body) {
  const r = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const t = await r.text();
  return { status: r.status, body: t ? JSON.parse(t) : null };
}

/** Signs in and returns {token, user}; throws if sign-in fails. */
export async function session(email, password = demoPassword) {
  const r = await j('POST', '/auth/login', null, { email, password });
  if (r.status !== 200) throw new Error(`Sign-in failed for ${email}: ${r.status}`);
  return r.body;
}

export const login = async (email, password) => (await session(email, password)).token;

export const minutes = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 60000);

const results = { pass: 0, fail: 0 };
export function check(name, ok, extra = '') {
  ok ? results.pass++ : results.fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
}

/** Prints the suite's totals and sets a failing exit code if any check failed. */
export function finish(suite) {
  console.log(`\n${suite}: ${results.pass} passed, ${results.fail} failed`);
  if (results.fail > 0) process.exitCode = 1;
}
