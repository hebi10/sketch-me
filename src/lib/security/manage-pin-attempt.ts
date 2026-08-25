export interface ManagePinAttemptState {
  failureCount: number;
  lockedUntil: Date | null;
}

const maxFailures = 5;
const lockDurationMs = 10 * 60 * 1_000;

export function nextManagePinAttempt(
  current: ManagePinAttemptState | null,
  isCorrectPin: boolean,
  now = new Date(),
): ManagePinAttemptState {
  if (current?.lockedUntil && current.lockedUntil > now) return current;
  if (isCorrectPin) return { failureCount: 0, lockedUntil: null };

  const failureCount = (current?.failureCount ?? 0) + 1;
  return {
    failureCount,
    lockedUntil: failureCount >= maxFailures ? new Date(now.getTime() + lockDurationMs) : null,
  };
}

export function getManagePinAttemptSource(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const source = forwarded || request.headers.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(source).digest('hex');
}
import { createHash } from 'node:crypto';
