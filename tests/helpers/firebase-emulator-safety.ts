export const LOCAL_FIREBASE_PROJECT_ID = 'sketch-me-local';

type Environment = Record<string, string | undefined>;
type EmulatorService = 'auth' | 'firestore' | 'storage';

const emulatorServices = {
  auth: {
    defaultHost: '127.0.0.1:9099',
    environmentName: 'FIREBASE_AUTH_EMULATOR_HOST',
    playwrightEnvironmentName: 'PLAYWRIGHT_AUTH_EMULATOR_HOST',
  },
  firestore: {
    defaultHost: '127.0.0.1:8080',
    environmentName: 'FIRESTORE_EMULATOR_HOST',
    playwrightEnvironmentName: 'PLAYWRIGHT_FIRESTORE_EMULATOR_HOST',
  },
  storage: {
    defaultHost: '127.0.0.1:9199',
    environmentName: 'FIREBASE_STORAGE_EMULATOR_HOST',
    playwrightEnvironmentName: 'PLAYWRIGHT_STORAGE_EMULATOR_HOST',
  },
} as const;

function isValidLoopbackUrl(url: URL) {
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const port = Number(url.port);
  if (
    !['127.0.0.1', 'localhost', '::1'].includes(hostname)
    || !Number.isInteger(port)
    || port <= 0
    || url.pathname !== '/'
    || url.search
    || url.hash
    || url.username
    || url.password
  ) {
    return null;
  }
  return { host: hostname, port };
}

function parseLoopbackAddress(value: string | undefined) {
  if (!value) return null;

  try {
    if (value.includes('://')) return null;
    const url = new URL(`http://${value}`);
    return isValidLoopbackUrl(url);
  } catch {
    return null;
  }
}

function parseAdminStorageAddress(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:') return null;
    return isValidLoopbackUrl(url);
  } catch {
    return null;
  }
}

function sameAddress(
  left: { host: string; port: number },
  right: { host: string; port: number },
) {
  return left.host === right.host && left.port === right.port;
}

function formatLoopbackAddress(address: { host: string; port: number }) {
  const host = address.host.includes(':') ? `[${address.host}]` : address.host;
  return `${host}:${address.port}`;
}

export function requireSafeFirebaseEmulatorEnvironment(
  services: EmulatorService[],
  environment: Environment = process.env,
) {
  if (environment.FIREBASE_PROJECT_ID !== LOCAL_FIREBASE_PROJECT_ID) {
    throw new Error(`Firebase emulator tests require FIREBASE_PROJECT_ID=${LOCAL_FIREBASE_PROJECT_ID}.`);
  }

  for (const service of services) {
    const { environmentName } = emulatorServices[service];
    const address = parseLoopbackAddress(environment[environmentName]);
    if (!address) {
      throw new Error(`Firebase emulator tests require ${environmentName} to use an explicit loopback host and port.`);
    }

    if (service === 'storage' && environment.STORAGE_EMULATOR_HOST) {
      const adminAddress = parseAdminStorageAddress(environment.STORAGE_EMULATOR_HOST);
      if (!adminAddress || !sameAddress(adminAddress, address)) {
        throw new Error(
          'Firebase emulator tests require STORAGE_EMULATOR_HOST to be an http loopback URL '
          + 'matching FIREBASE_STORAGE_EMULATOR_HOST without a path.',
        );
      }
    }
  }
}

export function normalizeFirebaseAdminStorageEmulatorEnvironment(
  environment: Environment = process.env,
  approvedHost = environment.FIREBASE_STORAGE_EMULATOR_HOST,
) {
  if (environment.FIREBASE_PROJECT_ID !== LOCAL_FIREBASE_PROJECT_ID) {
    throw new Error(`Firebase emulator tests require FIREBASE_PROJECT_ID=${LOCAL_FIREBASE_PROJECT_ID}.`);
  }

  const approvedAddress = parseLoopbackAddress(approvedHost);
  if (!approvedAddress) {
    throw new Error(
      'Firebase emulator tests require FIREBASE_STORAGE_EMULATOR_HOST to use a bare loopback host and port.',
    );
  }

  if (environment.FIREBASE_STORAGE_EMULATOR_HOST) {
    const firebaseAddress = parseLoopbackAddress(environment.FIREBASE_STORAGE_EMULATOR_HOST);
    if (!firebaseAddress || !sameAddress(firebaseAddress, approvedAddress)) {
      throw new Error('Preexisting FIREBASE_STORAGE_EMULATOR_HOST does not match the approved loopback host.');
    }
  }

  if (environment.STORAGE_EMULATOR_HOST) {
    const adminAddress = parseAdminStorageAddress(environment.STORAGE_EMULATOR_HOST);
    if (!adminAddress || !sameAddress(adminAddress, approvedAddress)) {
      throw new Error('Preexisting STORAGE_EMULATOR_HOST does not match the approved loopback host.');
    }
  }

  const normalizedHost = formatLoopbackAddress(approvedAddress);
  environment.FIREBASE_STORAGE_EMULATOR_HOST = normalizedHost;
  environment.STORAGE_EMULATOR_HOST = `http://${normalizedHost}`;
  return normalizedHost;
}

export function hasSafeFirebaseEmulatorEnvironment(
  services: EmulatorService[],
  environment: Environment = process.env,
) {
  try {
    requireSafeFirebaseEmulatorEnvironment(services, environment);
    return true;
  } catch {
    return false;
  }
}

export function getFirebaseEmulatorAddress(
  service: EmulatorService,
  environment: Environment = process.env,
) {
  requireSafeFirebaseEmulatorEnvironment([service], environment);
  return parseLoopbackAddress(environment[emulatorServices[service].environmentName])!;
}

export function resolvePlaywrightEmulatorHosts(
  environment: Environment = process.env,
  managesFirebaseEmulators = true,
) {
  return Object.fromEntries(
    (Object.keys(emulatorServices) as EmulatorService[]).map((service) => {
      const config = emulatorServices[service];
      const value = environment[config.playwrightEnvironmentName] ?? config.defaultHost;
      const address = parseLoopbackAddress(value);
      if (!address) {
        throw new Error(`${config.playwrightEnvironmentName} must use an explicit loopback host and port.`);
      }

      const managedPort = parseLoopbackAddress(config.defaultHost)!.port;
      if (managesFirebaseEmulators && address.port !== managedPort) {
        throw new Error(
          `${config.playwrightEnvironmentName} uses port ${address.port}, but firebase.json starts ${service} on ${managedPort}. `
          + 'Use the configured port or set PLAYWRIGHT_SKIP_WEBSERVER=1 and start isolated emulators yourself.',
        );
      }

      return [service, value];
    }),
  ) as Record<EmulatorService, string>;
}
