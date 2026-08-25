// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { waitForEmulatorReadiness } from '../../helpers/emulator-readiness';

const targets = [
  { name: 'Auth', host: '127.0.0.1', port: 19099 },
  { name: 'Firestore', host: '127.0.0.1', port: 18080 },
  { name: 'Storage', host: '127.0.0.1', port: 19199 },
];

describe('Emulator readiness', () => {
  it('polls every service until Auth, Firestore, and Storage are all ready', async () => {
    const attempts = new Map<string, number>();

    await waitForEmulatorReadiness(targets, {
      intervalMs: 0,
      timeoutMs: 100,
      probe: async ({ name }) => {
        const count = (attempts.get(name) ?? 0) + 1;
        attempts.set(name, count);
        return name !== 'Storage' || count >= 3;
      },
    });

    expect(Object.fromEntries(attempts)).toEqual({ Auth: 1, Firestore: 1, Storage: 3 });
  });

  it('fails within the bound and identifies services that never become ready', async () => {
    await expect(waitForEmulatorReadiness([targets[2]], {
      intervalMs: 1,
      timeoutMs: 10,
      probe: async () => false,
    })).rejects.toThrow(/10ms.*Storage.*127\.0\.0\.1:19199/);
  });
});
