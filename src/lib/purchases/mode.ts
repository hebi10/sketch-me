export type PaymentMode = 'DISABLED' | 'MOCK';

interface PaymentModeInput {
  configuredMode?: string;
  environment?: string;
}

export function resolvePaymentMode({ configuredMode, environment }: PaymentModeInput = {}): PaymentMode {
  if (environment === 'production') return 'DISABLED';
  return configuredMode === 'MOCK' ? 'MOCK' : 'DISABLED';
}

export function getServerPaymentMode(): PaymentMode {
  return resolvePaymentMode({
    configuredMode: process.env.PAYMENT_MODE,
    environment: process.env.NODE_ENV,
  });
}

export function getPublicPaymentMode(): PaymentMode {
  return resolvePaymentMode({
    configuredMode: process.env.NEXT_PUBLIC_PAYMENT_MODE,
    environment: process.env.NODE_ENV,
  });
}
