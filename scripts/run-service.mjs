// Starts the Java incident service with the same .env the Node API uses.
// Usage: npm run service   (build it first with npm run service:build)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
const jar = 'java/service/target/itsm-service.jar';
if (!existsSync(jar)) {
  console.error(`Missing ${jar}. Build it with: npm run service:build`);
  process.exit(1);
}
if (!process.env.ITSM_DB_PASSWORD) {
  console.error('Set ITSM_DB_PASSWORD in .env (see .env.example).');
  process.exit(1);
}
const child = spawn('java', ['-jar', jar], { stdio: 'inherit', env: process.env });
child.on('exit', code => process.exit(code ?? 0));
child.on('error', e => { console.error(`Could not start Java (${e.message}). Install JDK 21 and make sure "java" is on PATH.`); process.exit(1); });
