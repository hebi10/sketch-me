import { vi } from 'vitest';

const { cleanupExpiredSketchbooks } = vi.hoisted(() => ({
  cleanupExpiredSketchbooks: vi.fn(),
}));

const { verifyIdToken } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
}));

vi.mock('@/lib/sketchbooks/retention-cleanup', () => ({ cleanupExpiredSketchbooks }));
vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = verifyIdToken;
  },
}));

import { POST } from '@/app/api/internal/retention-cleanup/route';

describe('POST /api/internal/retention-cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RETENTION_CLEANUP_SECRET = 'cleanup-secret';
    process.env.RETENTION_CLEANUP_OIDC_AUDIENCE = 'https://sketch.msgnote.kr/api/internal/retention-cleanup';
    process.env.RETENTION_CLEANUP_SCHEDULER_SERVICE_ACCOUNT = 'retention-cleanup-scheduler@sketch-me-31e13.iam.gserviceaccount.com';
    cleanupExpiredSketchbooks.mockResolvedValue({
      attempted: 2,
      failed: 0,
      legalRecordsDeleted: 3,
      succeeded: 2,
    });
  });

  afterEach(() => {
    delete process.env.RETENTION_CLEANUP_OIDC_AUDIENCE;
    delete process.env.RETENTION_CLEANUP_SCHEDULER_SERVICE_ACCOUNT;
  });

  it('Bearer 비밀키가 없거나 다르면 정리 작업을 시작하지 않는다', async () => {
    const response = await POST(new Request('https://example.com/api/internal/retention-cleanup', {
      method: 'POST',
    }));

    expect(response.status).toBe(401);
    expect(cleanupExpiredSketchbooks).not.toHaveBeenCalled();
  });

  it('서버 비밀키 설정이 없으면 안전하게 503을 반환한다', async () => {
    delete process.env.RETENTION_CLEANUP_SECRET;
    delete process.env.RETENTION_CLEANUP_OIDC_AUDIENCE;
    delete process.env.RETENTION_CLEANUP_SCHEDULER_SERVICE_ACCOUNT;

    const response = await POST(new Request('https://example.com/api/internal/retention-cleanup', {
      headers: { authorization: 'Bearer cleanup-secret' },
      method: 'POST',
    }));

    expect(response.status).toBe(503);
    expect(cleanupExpiredSketchbooks).not.toHaveBeenCalled();
  });

  it('올바른 Bearer 비밀키만 정리를 실행하고 집계 결과를 반환한다', async () => {
    const response = await POST(new Request('https://example.com/api/internal/retention-cleanup', {
      headers: { authorization: 'Bearer cleanup-secret' },
      method: 'POST',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      attempted: 2,
      failed: 0,
      legalRecordsDeleted: 3,
      succeeded: 2,
    });
    expect(cleanupExpiredSketchbooks).toHaveBeenCalledTimes(1);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('지정된 Cloud Scheduler 서비스 계정의 OIDC 토큰으로 정리를 실행한다', async () => {
    delete process.env.RETENTION_CLEANUP_SECRET;
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'retention-cleanup-scheduler@sketch-me-31e13.iam.gserviceaccount.com',
        email_verified: true,
      }),
    });

    const response = await POST(new Request('https://example.com/api/internal/retention-cleanup', {
      headers: { authorization: 'Bearer scheduler-oidc-token' },
      method: 'POST',
    }));

    expect(response.status).toBe(200);
    expect(verifyIdToken).toHaveBeenCalledWith({
      audience: 'https://sketch.msgnote.kr/api/internal/retention-cleanup',
      idToken: 'scheduler-oidc-token',
    });
    expect(cleanupExpiredSketchbooks).toHaveBeenCalledTimes(1);
  });

  it('다른 서비스 계정의 OIDC 토큰으로는 정리를 실행하지 않는다', async () => {
    delete process.env.RETENTION_CLEANUP_SECRET;
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'other@sketch-me-31e13.iam.gserviceaccount.com',
        email_verified: true,
      }),
    });

    const response = await POST(new Request('https://example.com/api/internal/retention-cleanup', {
      headers: { authorization: 'Bearer scheduler-oidc-token' },
      method: 'POST',
    }));

    expect(response.status).toBe(401);
    expect(cleanupExpiredSketchbooks).not.toHaveBeenCalled();
  });
});
