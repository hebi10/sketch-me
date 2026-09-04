import { describe, expect, it } from 'vitest';

import {
  assertProductionAppCheckConfiguration,
  resolveAppCheckMode,
} from '@/lib/security/app-check-config';

describe('App Check 설정 판별', () => {
  it.each([
    [{ clientEnabled: false, enforcementEnabled: false, siteKey: '' }, 'disabled'],
    [{ clientEnabled: true, enforcementEnabled: true, siteKey: 'key' }, 'enabled'],
    [{ clientEnabled: true, enforcementEnabled: false, siteKey: 'key' }, 'misconfigured'],
    [{ clientEnabled: false, enforcementEnabled: true, siteKey: 'key' }, 'misconfigured'],
    [{ clientEnabled: true, enforcementEnabled: true, siteKey: '' }, 'misconfigured'],
    [{ clientEnabled: false, enforcementEnabled: false, siteKey: 'key' }, 'misconfigured'],
  ] as const)('%j 조합을 %s 상태로 판별한다', (input, expected) => {
    expect(resolveAppCheckMode(input)).toBe(expected);
  });

  it('운영 배포는 세 설정이 모두 활성화된 경우에만 허용한다', () => {
    expect(() => assertProductionAppCheckConfiguration({
      clientEnabled: true,
      enforcementEnabled: true,
      siteKey: 'public-site-key',
    })).not.toThrow();

    expect(() => assertProductionAppCheckConfiguration({
      clientEnabled: false,
      enforcementEnabled: false,
      siteKey: '',
    })).toThrow('APP_CHECK_PRODUCTION_CONFIGURATION_REQUIRED');
  });
});
