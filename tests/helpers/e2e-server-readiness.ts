import {
  E2E_READINESS_ORIGIN_HEADER,
  E2E_READINESS_PATH,
  resolvePlaywrightBaseUrl,
} from '../../src/lib/testing/e2e-readiness';

type ReadinessOptions = {
  intervalMs?: number;
  timeoutMs?: number;
};

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export async function verifyE2EServerReadiness(
  baseUrl: string,
  options: ReadinessOptions = {},
) {
  const origin = resolvePlaywrightBaseUrl(baseUrl);
  const intervalMs = options.intervalMs ?? 100;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    try {
      const response = await fetch(`${origin}${E2E_READINESS_PATH}`, {
        cache: 'no-store',
        headers: { [E2E_READINESS_ORIGIN_HEADER]: origin },
        redirect: 'error',
      });
      if (response.status === 204 && response.headers.get('x-sketch-me-e2e-ready') === '1') {
        return;
      }
      throw new Error('The local server did not confirm the isolated Playwright E2E environment.');
    } catch (error) {
      if (error instanceof Error && error.message.includes('did not confirm')) throw error;
      if (Date.now() >= deadline) {
        throw new Error('The local server did not confirm the isolated Playwright E2E environment.');
      }
      await delay(Math.min(intervalMs, Math.max(0, deadline - Date.now())));
    }
  }
}
