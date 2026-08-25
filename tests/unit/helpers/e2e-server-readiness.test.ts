// @vitest-environment node

import { createServer } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { verifyE2EServerReadiness } from '../../helpers/e2e-server-readiness';

const servers: Array<ReturnType<typeof createServer>> = [];

async function startServer(status: number, readyHeader?: string, requireExpectedEndpoints = false) {
  const server = createServer((request, response) => {
    if (requireExpectedEndpoints && (
      request.headers['x-sketch-me-e2e-origin'] !== `http://127.0.0.1:${(server.address() as { port: number }).port}`
      || request.headers['x-sketch-me-e2e-auth-emulator'] !== '127.0.0.1:19099'
      || request.headers['x-sketch-me-e2e-firestore-emulator'] !== '127.0.0.1:18080'
      || request.headers['x-sketch-me-e2e-storage-emulator'] !== '127.0.0.1:19199'
    )) {
      response.writeHead(503);
      response.end();
      return;
    }
    if (readyHeader) response.setHeader('x-sketch-me-e2e-ready', readyHeader);
    response.writeHead(status);
    response.end();
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('테스트 서버 주소를 확인하지 못했습니다.');
  return `http://127.0.0.1:${address.port}`;
}

describe('Playwright E2E server readiness handshake', () => {
  const expectedEmulators = {
    auth: '127.0.0.1:19099',
    firestore: '127.0.0.1:18080',
    storage: '127.0.0.1:19199',
  };

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })));
  });

  it('rejects a local server that does not prove the isolated E2E environment', async () => {
    const baseUrl = await startServer(503);

    await expect(verifyE2EServerReadiness(
      baseUrl,
      expectedEmulators,
      { intervalMs: 1, timeoutMs: 10 },
    ))
      .rejects.toThrow(/isolated Playwright E2E environment/);
  });

  it('accepts the exact readiness response from an isolated local server', async () => {
    const baseUrl = await startServer(204, '1', true);

    await expect(verifyE2EServerReadiness(
      baseUrl,
      expectedEmulators,
      { intervalMs: 1, timeoutMs: 100 },
    ))
      .resolves.toBeUndefined();
  });
});
