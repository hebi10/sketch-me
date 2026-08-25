export const ADMIN_E2E_SERVER_IDENTITY = {
  email: 'admin@example.com',
  uid: 'admin-e2e-uid',
} as const;

export const E2E_READINESS_PATH = '/api/e2e-readiness';
export const E2E_READINESS_ORIGIN_HEADER = 'X-Sketch-Me-E2E-Origin';
export const E2E_READINESS_EMULATOR_HEADERS = {
  auth: 'X-Sketch-Me-E2E-Auth-Emulator',
  firestore: 'X-Sketch-Me-E2E-Firestore-Emulator',
  storage: 'X-Sketch-Me-E2E-Storage-Emulator',
} as const;
export const E2E_NEXT_DIST_DIR = '.superpowers/sdd/2026-08-25-operator-admin/.next-task10';

type Environment = Record<string, string | undefined>;

type LoopbackAddress = {
  host: string;
  port: number;
};

export type E2EReadinessChallenge = {
  auth: string | null | undefined;
  firestore: string | null | undefined;
  origin: string | null | undefined;
  storage: string | null | undefined;
};

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export function resolveE2ENextDistDir(environment: Environment) {
  return environment.PLAYWRIGHT_E2E_SERVER === '1' ? E2E_NEXT_DIST_DIR : '.next';
}

function parseCanonicalHttpLoopbackOrigin(value: string | undefined | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (
      url.protocol !== 'http:'
      || !LOOPBACK_HOSTS.has(host)
      || url.port === '0'
      || url.pathname !== '/'
      || url.search
      || url.hash
      || url.username
      || url.password
      || value !== url.origin
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function parseBareLoopbackAddress(value: string | undefined): LoopbackAddress | null {
  if (!value || value.includes('://')) return null;
  const url = parseCanonicalHttpLoopbackOrigin(`http://${value}`);
  if (!url || !url.port) return null;
  return {
    host: url.hostname.replace(/^\[|\]$/g, '').toLowerCase(),
    port: Number(url.port),
  };
}

function parseStorageAdminAddress(value: string | undefined): LoopbackAddress | null {
  const url = parseCanonicalHttpLoopbackOrigin(value);
  if (!url || !url.port) return null;
  return {
    host: url.hostname.replace(/^\[|\]$/g, '').toLowerCase(),
    port: Number(url.port),
  };
}

function sameAddress(left: LoopbackAddress | null, right: LoopbackAddress | null) {
  return Boolean(left && right && left.host === right.host && left.port === right.port);
}

function formatLoopbackAddress(address: LoopbackAddress) {
  const host = address.host.includes(':') ? `[${address.host}]` : address.host;
  return `${host}:${address.port}`;
}

export function resolveE2EEmulatorEndpoint(value: string | undefined) {
  const address = parseBareLoopbackAddress(value);
  if (!address) {
    throw new Error('Playwright E2E emulator endpoints must use a bare loopback host and port.');
  }
  return formatLoopbackAddress(address);
}

export function resolvePlaywrightBaseUrl(value: string | undefined) {
  const url = parseCanonicalHttpLoopbackOrigin(
    value === undefined ? 'http://127.0.0.1:3000' : value,
  );
  if (!url) {
    throw new Error('PLAYWRIGHT_BASE_URL must be a bare HTTP loopback origin.');
  }
  return url.origin;
}

export type E2EServerReadinessState = 'hidden' | 'ready' | 'unavailable';

export function getE2EServerReadinessState(
  environment: Environment,
  challenge: E2EReadinessChallenge,
): E2EServerReadinessState {
  if (environment.PLAYWRIGHT_E2E_SERVER !== '1') return 'hidden';

  try {
    const auth = parseBareLoopbackAddress(environment.FIREBASE_AUTH_EMULATOR_HOST);
    const publicAuth = parseBareLoopbackAddress(environment.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST);
    const firestore = parseBareLoopbackAddress(environment.FIRESTORE_EMULATOR_HOST);
    const storage = parseBareLoopbackAddress(environment.FIREBASE_STORAGE_EMULATOR_HOST);
    const adminStorage = parseStorageAdminAddress(environment.STORAGE_EMULATOR_HOST);
    const allowedOrigin = parseCanonicalHttpLoopbackOrigin(environment.ADMIN_ALLOWED_ORIGIN);
    const expectedOrigin = parseCanonicalHttpLoopbackOrigin(challenge.origin);
    const expectedAuth = parseBareLoopbackAddress(challenge.auth ?? undefined);
    const expectedFirestore = parseBareLoopbackAddress(challenge.firestore ?? undefined);
    const expectedStorage = parseBareLoopbackAddress(challenge.storage ?? undefined);

    if (
      environment.FIREBASE_PROJECT_ID !== 'sketch-me-local'
      || environment.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET !== 'sketch-me-local.appspot.com'
      || environment.ADMIN_UID !== ADMIN_E2E_SERVER_IDENTITY.uid
      || environment.ADMIN_EMAIL !== ADMIN_E2E_SERVER_IDENTITY.email
      || !auth
      || !firestore
      || !storage
      || !allowedOrigin
      || !sameAddress(auth, publicAuth)
      || !sameAddress(storage, adminStorage)
      || !sameAddress(auth, expectedAuth)
      || !sameAddress(firestore, expectedFirestore)
      || !sameAddress(storage, expectedStorage)
      || allowedOrigin.origin !== expectedOrigin?.origin
    ) {
      return 'unavailable';
    }

    return 'ready';
  } catch {
    return 'unavailable';
  }
}
