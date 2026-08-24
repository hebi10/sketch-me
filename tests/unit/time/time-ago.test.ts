import { describe, expect, it } from 'vitest';

import { formatTimeAgo } from '@/lib/time/time-ago';

describe('formatTimeAgo', () => {
  it('한 시간 미만의 새 그림을 방금 전으로 표시한다', () => {
    const now = new Date('2026-08-24T07:00:00.000Z');

    expect(formatTimeAgo(new Date('2026-08-24T06:59:00.000Z'), now)).toBe('방금 전');
    expect(formatTimeAgo(new Date('2026-08-24T06:01:00.000Z'), now)).toBe('방금 전');
  });

  it('한 시간부터 시간과 일 단위로 표시한다', () => {
    const now = new Date('2026-08-24T07:00:00.000Z');

    expect(formatTimeAgo(new Date('2026-08-24T06:00:00.000Z'), now)).toBe('1시간 전');
    expect(formatTimeAgo(new Date('2026-08-22T07:00:00.000Z'), now)).toBe('2일 전');
  });
});
