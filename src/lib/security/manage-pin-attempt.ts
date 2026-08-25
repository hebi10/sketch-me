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
