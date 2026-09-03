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
