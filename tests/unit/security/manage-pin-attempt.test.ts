import { describe, expect, it } from 'vitest';

import { nextManagePinAttempt } from '@/lib/security/manage-pin-attempt';

describe('manage PIN attempt state', () => {
  it('locks a source for ten minutes after its fifth failed attempt', () => {
    const now = new Date('2026-08-25T00:00:00.000Z');
    let state = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      state = nextManagePinAttempt(state, false, now);
    }

    expect(state).toEqual({ failureCount: 5, lockedUntil: new Date('2026-08-25T00:10:00.000Z') });
  });

  it('resets failures after a correct PIN and rejects attempts during a lock', () => {
    const now = new Date('2026-08-25T00:00:00.000Z');

    expect(nextManagePinAttempt({ failureCount: 3, lockedUntil: null }, true, now)).toEqual({ failureCount: 0, lockedUntil: null });
    expect(nextManagePinAttempt({ failureCount: 5, lockedUntil: new Date('2026-08-25T00:10:00.000Z') }, false, now)).toEqual({ failureCount: 5, lockedUntil: new Date('2026-08-25T00:10:00.000Z') });
  });
});
