export function normalizeBuyerPhone(value: string): string | null {
  const normalized = value.replace(/[\s-]/g, '');
  return /^01(?:0\d{8}|[16789]\d{7,8})$/.test(normalized)
    ? normalized
    : null;
}
