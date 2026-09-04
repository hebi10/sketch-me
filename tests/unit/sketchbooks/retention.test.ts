import { describe, expect, it } from 'vitest';

import { addCalendarMonths, addCalendarYears } from '@/lib/sketchbooks/retention';

describe('스케치북 보관 기간 계산', () => {
  it('월말 생성일은 6개월 뒤 존재하는 마지막 날짜로 맞춘다', () => {
    expect(addCalendarMonths(new Date('2026-08-31T12:30:00.000Z'), 6))
      .toEqual(new Date('2027-02-28T12:30:00.000Z'));
  });

  it('윤년 2월 29일의 1년 보장은 다음 해 2월 말까지다', () => {
    expect(addCalendarYears(new Date('2028-02-29T08:00:00.000Z'), 1))
      .toEqual(new Date('2029-02-28T08:00:00.000Z'));
  });
});
