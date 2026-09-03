import { describe, expect, it } from 'vitest';

import { resolvePaymentMode } from '@/lib/purchases/mode';

describe('resolvePaymentMode', () => {
  it('설정이 없으면 모든 환경에서 결제를 비활성화한다', () => {
    expect(resolvePaymentMode({ environment: 'development' })).toBe('DISABLED');
    expect(resolvePaymentMode({ environment: 'test' })).toBe('DISABLED');
    expect(resolvePaymentMode({ environment: 'production' })).toBe('DISABLED');
  });

  it('개발과 테스트 환경에서는 명시적으로 설정한 MOCK만 허용한다', () => {
    expect(resolvePaymentMode({ configuredMode: 'MOCK', environment: 'development' })).toBe('MOCK');
    expect(resolvePaymentMode({ configuredMode: 'MOCK', environment: 'test' })).toBe('MOCK');
  });

  it('운영 환경에서는 MOCK을 설정해도 결제를 비활성화한다', () => {
    expect(resolvePaymentMode({ configuredMode: 'MOCK', environment: 'production' })).toBe('DISABLED');
  });
});
