// Runs every end-to-end suite against the running stack (PostgreSQL, Java service, Node API).
// Start them first (npm run db:setup, npm run service, npm run api), then: npm run test:e2e
// The suites create their own data with unique names, so they can be run again on the same database.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter } from 'node:path';

if (existsSync('.env')) process.loadEnvFile('.env');
const suites = ['admin', 'customer', 'priority', 'review-fixes'];
const failed = [];

const health = await fetch((process.env.E2E_API ?? 'http://127.0.0.1:3001/api/v1') + '/health').catch(() => null);
if (!health?.ok) {
  console.error('The API is not running. Start npm run service and npm run api first.');
  process.exit(1);
}

for (const suite of suites) {
  console.log(`\n=== ${suite} ===`);
  const r = spawnSync(process.execPath, ['--experimental-strip-types', `tests/e2e/${suite}.mjs`], { stdio: 'inherit' });
  if (r.status !== 0) failed.push(suite);
}

// The unit-of-work check talks to PostgreSQL directly (built by npm run service:build).
const classes = 'java/service/target/test-classes';
if (existsSync(classes)) {
  console.log('\n=== transactions ===');
  const cp = [classes, 'java/service/target/itsm-service.jar'].join(delimiter);
  const r = spawnSync('java', ['-cp', cp, 'com.railway.itsm.service.TransactionCheck'], { stdio: 'inherit', env: process.env });
  if (r.error) console.error(`Could not start Java (${r.error.message}). Install JDK 21 and put "java" on PATH.`);
  if (r.status !== 0) failed.push('transactions');
} else {
  console.log('\n(skipped the transaction check: run npm run service:build first)');
}

console.log(failed.length ? `\nFailed suites: ${failed.join(', ')}` : '\nAll end-to-end suites passed.');
process.exitCode = failed.length ? 1 : 0;
