import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Password hashing with scrypt (memory-hard, built into Node, no native addon to install).
// Stored format: scrypt$N$r$p$<salt base64url>$<hash base64url>, so parameters can be raised later
// without breaking existing hashes.

const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltText, hashText] = parts;
  const expected = Buffer.from(hashText, 'base64url');
  const actual = await derive(password, Buffer.from(saltText, 'base64url'), { N: Number(N), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Used when the email is unknown so a failed login takes about as long as a wrong password.
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('not-a-real-password-1');
  await verifyPassword(password, await dummyHash);
}
