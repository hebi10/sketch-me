// @vitest-environment node

import { createServer } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { verifyE2EServerReadiness } from '../../helpers/e2e-server-readiness';

const servers: Array<ReturnType<typeof createServer>> = [];

async function startServer(status: number, readyHeader?: string) {
  const server = createServer((_request, response) => {
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
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })));
  });

  it('rejects a local server that does not prove the isolated E2E environment', async () => {
    const baseUrl = await startServer(503);

    await expect(verifyE2EServerReadiness(baseUrl, { intervalMs: 1, timeoutMs: 10 }))
      .rejects.toThrow(/isolated Playwright E2E environment/);
  });

  it('accepts the exact readiness response from an isolated local server', async () => {
    const baseUrl = await startServer(204, '1');

    await expect(verifyE2EServerReadiness(baseUrl, { intervalMs: 1, timeoutMs: 100 }))
      .resolves.toBeUndefined();
  });
});
