import { vi } from 'vitest';

const {
  getAppCheck,
  getFirebaseAdminApp,
  getFirebaseClientApp,
  getToken,
  initializeAppCheck,
  recaptchaProvider,
  verifyToken,
} = vi.hoisted(() => ({
  getAppCheck: vi.fn(),
  getFirebaseAdminApp: vi.fn(() => ({ name: 'admin-app' })),
  getFirebaseClientApp: vi.fn(() => ({ name: 'client-app' })),
  getToken: vi.fn(),
  initializeAppCheck: vi.fn(),
  recaptchaProvider: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock('firebase/app-check', () => ({
  getToken,
  initializeAppCheck,
  ReCaptchaV3Provider: class ReCaptchaV3Provider {
    constructor(siteKey: string) {
      recaptchaProvider(siteKey);
    }
  },
}));

vi.mock('firebase-admin/app-check', () => ({ getAppCheck }));
vi.mock('@/lib/firebase/admin', () => ({ getFirebaseAdminApp }));
vi.mock('@/lib/firebase/client', () => ({ getFirebaseClientApp }));

describe('공개 mutation App Check 클라이언트 헤더', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('사이트 키가 없으면 Firebase를 초기화하지 않고 빈 헤더를 반환한다', async () => {
    const { getPublicMutationHeaders } = await import('@/lib/security/app-check-client');

    await expect(getPublicMutationHeaders()).resolves.toEqual({});
    expect(getFirebaseClientApp).not.toHaveBeenCalled();
    expect(initializeAppCheck).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });

  it('공개 활성 플래그와 사이트 키가 불일치하면 초기화하지 않고 보안 오류를 반환한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY', 'public-site-key');
    getToken.mockResolvedValue({ token: 'token-that-must-not-be-issued' });
    const { getPublicMutationHeaders } = await import('@/lib/security/app-check-client');

    await expect(getPublicMutationHeaders()).rejects.toThrow('보안 확인을 완료하지 못했어요.');
    expect(getFirebaseClientApp).not.toHaveBeenCalled();
    expect(initializeAppCheck).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });

  it('공개 활성 플래그만 켜진 경우에도 초기화하지 않고 보안 오류를 반환한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED', 'true');
    const { getPublicMutationHeaders } = await import('@/lib/security/app-check-client');

    await expect(getPublicMutationHeaders()).rejects.toThrow('보안 확인을 완료하지 못했어요.');
    expect(getFirebaseClientApp).not.toHaveBeenCalled();
    expect(initializeAppCheck).not.toHaveBeenCalled();
  });

  it('사이트 키가 있으면 한 번만 지연 초기화하고 매 요청에 최신 토큰을 싣는다', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY', 'public-site-key');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED', 'true');
    const appCheck = { name: 'app-check' };
    initializeAppCheck.mockReturnValue(appCheck);
    getToken
      .mockResolvedValueOnce({ token: 'token-1' })
      .mockResolvedValueOnce({ token: 'token-2' });
    const { getPublicMutationHeaders } = await import('@/lib/security/app-check-client');

    await expect(getPublicMutationHeaders()).resolves.toEqual({ 'X-Firebase-AppCheck': 'token-1' });
    await expect(getPublicMutationHeaders()).resolves.toEqual({ 'X-Firebase-AppCheck': 'token-2' });
    expect(recaptchaProvider).toHaveBeenCalledOnce();
    expect(recaptchaProvider).toHaveBeenCalledWith('public-site-key');
    expect(initializeAppCheck).toHaveBeenCalledOnce();
    expect(getToken).toHaveBeenCalledTimes(2);
  });
});

describe('공개 mutation App Check 서버 검증', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('FIREBASE_APP_CHECK_ENFORCEMENT_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY', '');
    getAppCheck.mockReturnValue({ verifyToken });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('강제가 비활성이면 토큰 없이 기존 요청을 허용한다', async () => {
    const { enforceAppCheck } = await import('@/lib/security/app-check-server');

    await expect(enforceAppCheck(new Request('http://localhost/api/sketchbooks'))).resolves.toBeNull();
    expect(getAppCheck).not.toHaveBeenCalled();
  });

  it('강제가 활성이고 토큰이 유효하면 요청당 한 번 검증하고 허용한다', async () => {
    vi.stubEnv('FIREBASE_APP_CHECK_ENFORCEMENT_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY', 'public-site-key');
    verifyToken.mockResolvedValue({ appId: 'web-app' });
    const { enforceAppCheck } = await import('@/lib/security/app-check-server');
    const request = new Request('http://localhost/api/sketchbooks', {
      headers: { 'X-Firebase-AppCheck': 'valid-token' },
    });

    await expect(enforceAppCheck(request)).resolves.toBeNull();
    expect(verifyToken).toHaveBeenCalledOnce();
    expect(verifyToken).toHaveBeenCalledWith('valid-token');
  });

  it.each([
    { code: null, label: '토큰이 없으면' },
    { code: 'app-check/invalid-argument', label: '토큰이 유효하지 않으면' },
    { code: 'app-check/app-check-token-expired', label: '토큰이 만료되면' },
  ])('$label 비밀값 없는 401을 반환한다', async ({ code }) => {
    vi.stubEnv('FIREBASE_APP_CHECK_ENFORCEMENT_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY', 'public-site-key');
    if (code) verifyToken.mockRejectedValue({ code, message: 'SECRET_TOKEN=do-not-expose' });
    const { enforceAppCheck } = await import('@/lib/security/app-check-server');
    const request = new Request('http://localhost/api/sketchbooks', {
      headers: code ? { 'X-Firebase-AppCheck': 'invalid-token' } : undefined,
    });

    const response = await enforceAppCheck(request);

    expect(response?.status).toBe(401);
    const body = await response?.text();
    expect(JSON.parse(body ?? '')).toEqual({
      message: '보안 확인에 실패했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
    });
    expect(body).not.toContain('SECRET_TOKEN');
  });

  it('강제 설정에 필요한 클라이언트 키가 없으면 검증하지 않고 503을 반환한다', async () => {
    vi.stubEnv('FIREBASE_APP_CHECK_ENFORCEMENT_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED', 'true');
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { enforceAppCheck } = await import('@/lib/security/app-check-server');

    const response = await enforceAppCheck(new Request('http://localhost/api/sketchbooks', {
      headers: { 'X-Firebase-AppCheck': 'token-that-cannot-be-issued' },
    }));

    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({
      message: '보안 확인을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.',
    });
    expect(getAppCheck).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('APP_CHECK_CONFIGURATION_INVALID');
    log.mockRestore();
  });

  it('서버 검증 구성이 실패하면 오류 세부정보를 숨긴 503을 반환한다', async () => {
    vi.stubEnv('FIREBASE_APP_CHECK_ENFORCEMENT_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY', 'public-site-key');
    getAppCheck.mockImplementation(() => {
      throw new Error('SERVICE_ACCOUNT_SECRET=do-not-expose');
    });
    const { enforceAppCheck } = await import('@/lib/security/app-check-server');

    const response = await enforceAppCheck(new Request('http://localhost/api/sketchbooks', {
      headers: { 'X-Firebase-AppCheck': 'token' },
    }));

    expect(response?.status).toBe(503);
    const body = await response?.text();
    expect(body).toContain('보안 확인을 준비하지 못했어요.');
    expect(body).not.toContain('SERVICE_ACCOUNT_SECRET');
  });

  it.each([
    { clientEnabled: 'true', enforcementEnabled: 'false', siteKey: 'SECRET_SITE_KEY' },
    { clientEnabled: 'false', enforcementEnabled: 'true', siteKey: 'SECRET_SITE_KEY' },
    { clientEnabled: 'false', enforcementEnabled: 'false', siteKey: 'SECRET_SITE_KEY' },
  ])('불완전한 설정은 비밀값 없이 503을 반환한다: %j', async (configuration) => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED', configuration.clientEnabled);
    vi.stubEnv('FIREBASE_APP_CHECK_ENFORCEMENT_ENABLED', configuration.enforcementEnabled);
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY', configuration.siteKey);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { enforceAppCheck } = await import('@/lib/security/app-check-server');

    const response = await enforceAppCheck(new Request('http://localhost/api/sketchbooks', {
      headers: { 'X-Firebase-AppCheck': 'token-that-must-not-be-verified' },
    }));

    expect(response?.status).toBe(503);
    expect(getAppCheck).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).toContain('APP_CHECK_CONFIGURATION_INVALID');
    expect(JSON.stringify(log.mock.calls)).not.toContain(configuration.siteKey);
    log.mockRestore();
  });
});
