import { vi } from 'vitest';

const { cleanupExpiredSketchbooks } = vi.hoisted(() => ({
  cleanupExpiredSketchbooks: vi.fn(),
}));

vi.mock('@/lib/sketchbooks/retention-cleanup', () => ({ cleanupExpiredSketchbooks }));

import { POST } from '@/app/api/internal/retention-cleanup/route';

describe('POST /api/internal/retention-cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RETENTION_CLEANUP_SECRET = 'cleanup-secret';
    cleanupExpiredSketchbooks.mockResolvedValue({
      attempted: 2,
      failed: 0,
      legalRecordsDeleted: 3,
      succeeded: 2,
    });
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
  });
});
