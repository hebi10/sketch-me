import { vi } from 'vitest';

const { connectAuthEmulator, firebaseApp, getAuth, getFirebaseClientApp } = vi.hoisted(() => ({
  connectAuthEmulator: vi.fn(),
  firebaseApp: { name: '[DEFAULT]' },
  getAuth: vi.fn(),
  getFirebaseClientApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  connectAuthEmulator,
  getAuth,
}));

vi.mock('@/lib/firebase/client', () => ({ getFirebaseClientApp }));

describe('getFirebaseClientAuth', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    getFirebaseClientApp.mockReturnValue(firebaseApp);
    getAuth.mockReturnValue({ app: firebaseApp });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('emulator 환경 변수가 없으면 Auth emulator를 연결하지 않는다', async () => {
    const { getFirebaseClientAuth } = await import('@/lib/firebase/auth-client');

    const auth = getFirebaseClientAuth();

    expect(auth).toEqual({ app: firebaseApp });
    expect(getAuth).toHaveBeenCalledWith(firebaseApp);
    expect(connectAuthEmulator).not.toHaveBeenCalled();
  });

  it('설정된 host와 경고 비활성화 옵션으로 Auth emulator를 연결한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');
    const { getFirebaseClientAuth } = await import('@/lib/firebase/auth-client');

    const auth = getFirebaseClientAuth();

    expect(connectAuthEmulator).toHaveBeenCalledWith(
      auth,
      'http://127.0.0.1:9099',
      { disableWarnings: true },
    );
  });

  it('반복 호출해도 Auth emulator는 한 번만 연결한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');
    const { getFirebaseClientAuth } = await import('@/lib/firebase/auth-client');

    getFirebaseClientAuth();
    getFirebaseClientAuth();

    expect(connectAuthEmulator).toHaveBeenCalledTimes(1);
  });
});
