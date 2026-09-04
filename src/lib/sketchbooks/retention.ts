export function addCalendarMonths(date: Date, months: number) {
  const result = new Date(date);
  const targetMonth = date.getUTCMonth() + months;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();

  result.setUTCDate(1);
  result.setUTCFullYear(targetYear, normalizedMonth, Math.min(date.getUTCDate(), lastDay));
  return result;
}

export function addCalendarYears(date: Date, years: number) {
  return addCalendarMonths(date, years * 12);
}

export function paidRetentionUpdate(paidAt: Date) {
  return {
    retentionExpiresAt: null,
    retentionGuaranteedUntil: addCalendarYears(paidAt, 1),
    retentionTier: 'PAID' as const,
  };
}
