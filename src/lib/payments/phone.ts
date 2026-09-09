/* 결제 시스템 비활성화: 기존 결제용 휴대전화번호 정규화 코드를 보존합니다.
export function normalizeBuyerPhone(value: string): string | null {
  const normalized = value.replace(/[\s-]/g, '');
  return /^01(?:0\d{8}|[16789]\d{7,8})$/.test(normalized)
    ? normalized
    : null;
}
*/

export {};
