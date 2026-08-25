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

function parseLoopbackAddress(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(`http://${value}`);
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const port = Number(url.port);
    if (!['127.0.0.1', 'localhost', '::1'].includes(hostname) || !Number.isInteger(port) || port <= 0) {
      return null;
    }
    return { host: hostname, port };
  } catch {
    return null;
  }
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
    if (!parseLoopbackAddress(environment[environmentName])) {
      throw new Error(`Firebase emulator tests require ${environmentName} to use an explicit loopback host and port.`);
    }
  }
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
