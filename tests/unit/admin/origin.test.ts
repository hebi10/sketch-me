import { afterEach, describe, expect, it, vi } from 'vitest';

import { isAllowedAdminOrigin } from '@/lib/admin/origin';

describe('관리자 Origin 검증', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('설정된 관리자 Origin만 허용한다', () => {
    vi.stubEnv('ADMIN_ALLOWED_ORIGIN', 'https://sketch.example.com');

    expect(isAllowedAdminOrigin(new Request('https://internal/api/admin', { headers: { Origin: 'https://sketch.example.com' } }))).toBe(true);
    expect(isAllowedAdminOrigin(new Request('https://internal/api/admin', { headers: { Origin: 'https://evil.example' } }))).toBe(false);
  });

  it('로컬 Origin도 환경 변수와 정확히 같을 때만 허용한다', () => {
    vi.stubEnv('ADMIN_ALLOWED_ORIGIN', 'http://127.0.0.1:3000');

    expect(isAllowedAdminOrigin(new Request('http://internal/api/admin', { headers: { Origin: 'http://127.0.0.1:3000' } }))).toBe(true);
    expect(isAllowedAdminOrigin(new Request('http://internal/api/admin', { headers: { Origin: 'http://localhost:3000' } }))).toBe(false);
  });

  it('Origin 또는 설정이 없으면 요청을 거부한다', () => {
    vi.stubEnv('ADMIN_ALLOWED_ORIGIN', '');

    expect(isAllowedAdminOrigin(new Request('https://internal/api/admin'))).toBe(false);
    expect(isAllowedAdminOrigin(new Request('https://internal/api/admin', { headers: { Origin: 'https://sketch.example.com' } }))).toBe(false);
  });
});
