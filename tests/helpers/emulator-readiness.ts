import { connect } from 'node:net';

export type EmulatorReadinessTarget = {
  host: string;
  name: string;
  port: number;
};

type ReadinessOptions = {
  intervalMs?: number;
  probe?: (target: EmulatorReadinessTarget) => Promise<boolean>;
  timeoutMs?: number;
};

function probeTcp(target: EmulatorReadinessTarget) {
  return new Promise<boolean>((resolve) => {
    const socket = connect({ host: target.host, port: target.port });
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ready);
    };

    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(500, () => finish(false));
  });
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export async function waitForEmulatorReadiness(
  targets: EmulatorReadinessTarget[],
  options: ReadinessOptions = {},
) {
  const intervalMs = options.intervalMs ?? 100;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const probe = options.probe ?? probeTcp;
  const deadline = Date.now() + timeoutMs;
  let pending = [...targets];

  while (pending.length > 0) {
    const results = await Promise.all(pending.map(async (target) => ({
      ready: await probe(target).catch(() => false),
      target,
    })));
    pending = results.filter(({ ready }) => !ready).map(({ target }) => target);
    if (pending.length === 0) return;

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      const unavailable = pending.map(({ name, host, port }) => `${name} (${host}:${port})`).join(', ');
      throw new Error(`Firebase Emulator readiness timed out after ${timeoutMs}ms: ${unavailable}`);
    }
    await delay(Math.min(intervalMs, remainingMs));
  }
}
