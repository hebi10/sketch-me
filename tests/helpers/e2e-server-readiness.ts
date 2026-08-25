import {
  E2E_READINESS_EMULATOR_HEADERS,
  E2E_READINESS_ORIGIN_HEADER,
  E2E_READINESS_PATH,
  resolveE2EEmulatorEndpoint,
  resolvePlaywrightBaseUrl,
} from '../../src/lib/testing/e2e-readiness';

type ReadinessOptions = {
  intervalMs?: number;
  timeoutMs?: number;
};

type ExpectedEmulatorEndpoints = {
  auth: string;
  firestore: string;
  storage: string;
};

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export async function verifyE2EServerReadiness(
  baseUrl: string,
  expectedEmulators: ExpectedEmulatorEndpoints,
  options: ReadinessOptions = {},
) {
  const origin = resolvePlaywrightBaseUrl(baseUrl);
  const expectedAuth = resolveE2EEmulatorEndpoint(expectedEmulators.auth);
  const expectedFirestore = resolveE2EEmulatorEndpoint(expectedEmulators.firestore);
  const expectedStorage = resolveE2EEmulatorEndpoint(expectedEmulators.storage);
  const intervalMs = options.intervalMs ?? 100;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new Error('Timed out waiting for the local server to confirm the isolated Playwright E2E environment.');
    }

    const controller = new AbortController();
    const requestTimeout = setTimeout(() => controller.abort(), remainingMs);
    let response: Response | undefined;
    try {
      response = await fetch(`${origin}${E2E_READINESS_PATH}`, {
        cache: 'no-store',
        headers: {
          [E2E_READINESS_EMULATOR_HEADERS.auth]: expectedAuth,
          [E2E_READINESS_EMULATOR_HEADERS.firestore]: expectedFirestore,
          [E2E_READINESS_EMULATOR_HEADERS.storage]: expectedStorage,
          [E2E_READINESS_ORIGIN_HEADER]: origin,
        },
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      // Connection errors retry below until the shared deadline expires.
    } finally {
      clearTimeout(requestTimeout);
    }

    if (response) {
      if (response.status === 204 && response.headers.get('x-sketch-me-e2e-ready') === '1') return;
      throw new Error('The local server did not confirm the isolated Playwright E2E environment.');
    }

    if (controller.signal.aborted || Date.now() >= deadline) {
      throw new Error('Timed out waiting for the local server to confirm the isolated Playwright E2E environment.');
    }
    await delay(Math.min(intervalMs, Math.max(0, deadline - Date.now())));
  }
}
