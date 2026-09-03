import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy } from '../../../src/lib/security/content-security-policy';

function getDirectiveSources(policy: string, directiveName: string): string[] {
  const directive = policy
    .split(';')
    .map((part) => part.trim().split(/\s+/))
    .find(([name]) => name === directiveName);

  return directive?.slice(1) ?? [];
}

describe('Content Security Policy', () => {
  it('Firebase Google 팝업 로그인에 필요한 외부 리소스를 허용한다', () => {
    const policy = buildContentSecurityPolicy({ isProduction: true });

    expect(getDirectiveSources(policy, 'script-src')).toContain('https://apis.google.com');
    expect(getDirectiveSources(policy, 'frame-src')).toContain(
      'https://sketch-me-31e13.firebaseapp.com',
    );
  });
});
