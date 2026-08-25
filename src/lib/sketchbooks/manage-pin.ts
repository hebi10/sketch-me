import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export function createManageSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashManageSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function hashManagePin(pin: string) {
  const salt = randomBytes(16).toString('base64url');
  const key = Buffer.from(await scryptAsync(pin, salt, 64) as ArrayBuffer);
  return `scrypt$${salt}$${key.toString('base64url')}`;
}

export async function verifyManagePin(pin: string, encodedHash: string) {
  const [algorithm, salt, expectedHash] = encodedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHash) return false;

  const expected = Buffer.from(expectedHash, 'base64url');
  const actual = Buffer.from(await scryptAsync(pin, salt, expected.length) as ArrayBuffer);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
