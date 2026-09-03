export type PaymentMode = 'DISABLED' | 'MOCK';

interface PaymentModeInput {
  configuredMode?: string;
  environment?: string;
}

export function resolvePaymentMode(input: PaymentModeInput = {}): PaymentMode {
  void input;
  return 'MOCK';
}

export function getServerPaymentMode(): PaymentMode {
  return resolvePaymentMode();
}

export function getPublicPaymentMode(): PaymentMode {
  return resolvePaymentMode();
}
