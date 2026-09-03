import { describe, expect, it } from 'vitest';

import { resolvePaymentMode } from '@/lib/purchases/mode';

describe('resolvePaymentMode', () => {
  it('설정이 없어도 모든 환경에서 심사용 결제를 활성화한다', () => {
    expect(resolvePaymentMode({ environment: 'development' })).toBe('PAYAPP');
    expect(resolvePaymentMode({ environment: 'test' })).toBe('PAYAPP');
    expect(resolvePaymentMode({ environment: 'production' })).toBe('PAYAPP');
  });

  it('기존 비활성 환경 변수가 남아 있어도 결제 동작을 제공한다', () => {
    expect(resolvePaymentMode({ configuredMode: 'DISABLED', environment: 'production' })).toBe('PAYAPP');
  });
});
