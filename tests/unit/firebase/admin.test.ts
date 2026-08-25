import { vi } from 'vitest';

const { getApps, initializeApp, getAuth } = vi.hoisted(() => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn((options: Record<string, unknown>) => ({ options })),
  getAuth: vi.fn(),
}));

vi.mock('firebase-admin/app', () => ({ getApps, initializeApp }));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: vi.fn() }));
vi.mock('firebase-admin/storage', () => ({ getStorage: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({ getAuth }));

import { getAdminAuth, getFirebaseAdminApp } from '@/lib/firebase/admin';

describe('Firebase Admin 초기화', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('공개 Firebase 설정의 프로젝트 ID를 Admin SDK에 명시적으로 전달한다', () => {
    vi.stubEnv('GCLOUD_PROJECT', '');
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', '');
    vi.stubEnv('FIREBASE_PROJECT_ID', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'sketch-me-31e13');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'sketch-me-31e13.firebasestorage.app');

    const app = getFirebaseAdminApp() as unknown as { options: Record<string, unknown> };

    expect(app.options).toEqual({
      projectId: 'sketch-me-31e13',
      storageBucket: 'sketch-me-31e13.firebasestorage.app',
    });
  });

  it('초기화한 Admin 앱에서 Auth 클라이언트를 가져온다', () => {
    const auth = { verifyIdToken: vi.fn() };
    getAuth.mockReturnValue(auth);

    expect(getAdminAuth()).toBe(auth);
    expect(getAuth).toHaveBeenCalledWith(expect.objectContaining({ options: expect.any(Object) }));
  });
});
