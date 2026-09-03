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
