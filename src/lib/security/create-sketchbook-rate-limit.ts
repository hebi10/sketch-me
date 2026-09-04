import { createHmac } from 'node:crypto';

import type { Firestore } from 'firebase-admin/firestore';

import { getAdminFirestore } from '@/lib/firebase/admin';
import type { RateLimitResult } from '@/lib/security/public-mutation-rate-limiter';

const collectionName = 'publicMutationRateLimits';
const hourMs = 60 * 60 * 1_000;
const longWindowMs = 72 * hourMs;
const perIpHourLimit = 3;
const perIpLongLimit = 9;
const globalHourLimit = 60;

interface WindowState {
  count: number;
  startedAt: number;
}

function requestIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded ?? request.headers.get('x-real-ip') ?? 'unknown')
    .replace(/[^a-fA-F0-9.:]/g, '')
    .slice(0, 64) || 'unknown';
}

function toMillis(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  const millis = new Date(value as string | number | Date).getTime();
  return Number.isFinite(millis) ? millis : null;
}

function currentWindow(
  data: Record<string, unknown>,
  prefix: 'hour' | 'long',
  durationMs: number,
  nowMs: number,
): WindowState {
  const startedAt = toMillis(data[`${prefix}StartedAt`]);
  const count = Number(data[`${prefix}Count`] ?? 0);
  if (startedAt === null || nowMs - startedAt >= durationMs || nowMs < startedAt) {
    return { count: 0, startedAt: nowMs };
  }
  return { count: Number.isFinite(count) && count > 0 ? count : 0, startedAt };
}

function retrySeconds(window: WindowState, durationMs: number, nowMs: number) {
  return Math.max(1, Math.ceil((window.startedAt + durationMs - nowMs) / 1_000));
}

export function createFirestoreCreateSketchbookRateLimiter({
  firestore,
  secret,
}: {
  firestore: Firestore;
  secret: string;
}) {
  const normalizedSecret = secret.trim();
  if (!normalizedSecret) throw new Error('PublicMutationRateLimitSecretMissing');

  return async function consume(request: Request, now = new Date()): Promise<RateLimitResult> {
    const nowMs = now.getTime();
    const ipHash = createHmac('sha256', normalizedSecret)
      .update(requestIp(request))
      .digest('hex');
    const collection = firestore.collection(collectionName);
    const ipReference = collection.doc(`ip_${ipHash}`);
    const globalReference = collection.doc('global');

    return firestore.runTransaction(async (transaction) => {
      const [ipDocument, globalDocument] = await Promise.all([
        transaction.get(ipReference),
        transaction.get(globalReference),
      ]);
      const ipData = ipDocument.data() ?? {};
      const globalData = globalDocument.data() ?? {};
      const ipHour = currentWindow(ipData, 'hour', hourMs, nowMs);
      const ipLong = currentWindow(ipData, 'long', longWindowMs, nowMs);
      const globalHour = currentWindow(globalData, 'hour', hourMs, nowMs);
      const blockedRetrySeconds = [
        ipHour.count >= perIpHourLimit ? retrySeconds(ipHour, hourMs, nowMs) : 0,
        ipLong.count >= perIpLongLimit ? retrySeconds(ipLong, longWindowMs, nowMs) : 0,
        globalHour.count >= globalHourLimit ? retrySeconds(globalHour, hourMs, nowMs) : 0,
      ];
      const retryAfter = Math.max(...blockedRetrySeconds);
      if (retryAfter > 0) return { allowed: false, retryAfter };

      transaction.set(ipReference, {
        expiresAt: new Date(ipLong.startedAt + longWindowMs),
        hourCount: ipHour.count + 1,
        hourStartedAt: new Date(ipHour.startedAt),
        longCount: ipLong.count + 1,
        longStartedAt: new Date(ipLong.startedAt),
        updatedAt: now,
      });
      transaction.set(globalReference, {
        expiresAt: new Date(globalHour.startedAt + hourMs),
        hourCount: globalHour.count + 1,
        hourStartedAt: new Date(globalHour.startedAt),
        updatedAt: now,
      });
      return { allowed: true, retryAfter: 0 };
    });
  };
}

export function consumeCreateSketchbookRateLimit(request: Request, now = new Date()) {
  return createFirestoreCreateSketchbookRateLimiter({
    firestore: getAdminFirestore(),
    secret: process.env.PUBLIC_MUTATION_RATE_LIMIT_SECRET ?? '',
  })(request, now);
}
