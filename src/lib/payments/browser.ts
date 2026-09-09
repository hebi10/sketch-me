/* 결제 시스템 비활성화: 기존 브라우저 결제창 이동 코드를 보존합니다.
export function openPaymentUrl(value: string): void {
  const url = new URL(value);
  if (
    url.protocol !== 'https:'
    || (url.hostname !== 'payapp.kr' && !url.hostname.endsWith('.payapp.kr'))
  ) {
    throw new Error('안전한 결제 주소를 확인하지 못했습니다.');
  }
  window.location.assign(url.toString());
}
*/

export {};
