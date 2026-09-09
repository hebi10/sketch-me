/* 결제 시스템 비활성화: 기존 결제 모드 선택 코드를 보존합니다.
export type PaymentMode = 'PAYAPP';

interface PaymentModeInput {
  configuredMode?: string;
  environment?: string;
}

export function resolvePaymentMode(input: PaymentModeInput = {}): PaymentMode {
  void input;
  return 'PAYAPP';
}

export function getServerPaymentMode(): PaymentMode {
  return resolvePaymentMode();
}

export function getPublicPaymentMode(): PaymentMode {
  return resolvePaymentMode();
}
*/

export {};
