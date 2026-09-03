import { vi } from 'vitest';

const {
  consumeManagePinAttempt,
  createManagePinSession,
  findSketchbookByPublicId,
  verifyManagePin,
} = vi.hoisted(() => ({
  consumeManagePinAttempt: vi.fn(),
  createManagePinSession: vi.fn(),
  findSketchbookByPublicId: vi.fn(),
  verifyManagePin: vi.fn(),
}));

vi.mock('@/lib/sketchbooks/manage-pin', () => ({ verifyManagePin }));
vi.mock('@/lib/sketchbooks/repository', () => ({
  consumeManagePinAttempt,
  createManagePinSession,
  findSketchbookByPublicId,
}));

import { POST } from '@/app/api/manage/[publicId]/session/route';

const sketchbook = { id: 'book-1', managePinHash: 'scrypt$salt$hash' };
const context = { params: Promise.resolve({ publicId: 'public-1' }) };

describe('POST /api/manage/:publicId/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSketchbookByPublicId.mockResolvedValue(sketchbook);
    consumeManagePinAttempt.mockResolvedValue({
      attempt: { failureCount: 0, lockedUntil: null },
      wasLocked: false,
    });
    createManagePinSession.mockResolvedValue({ sessionId: 'session-1', token: 'secret-token' });
  });

  it('올바른 네 자리 PIN에 한해 httpOnly 관리 세션을 만든다', async () => {
    verifyManagePin.mockResolvedValue(true);
    const response = await POST(new Request('http://localhost/api/manage/public-1/session', {
      body: JSON.stringify({ pin: '1234' }),
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
      method: 'POST',
    }), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(consumeManagePinAttempt).toHaveBeenCalledWith('book-1', expect.any(String), true, expect.any(Date));
    expect(response.headers.get('set-cookie')).toContain('sketchbook_manage_token=public-1.session-1.secret-token');
  });

  it('잘못된 PIN을 저장하되 세션은 발급하지 않는다', async () => {
    verifyManagePin.mockResolvedValue(false);
    consumeManagePinAttempt.mockResolvedValueOnce({
      attempt: { failureCount: 1, lockedUntil: null },
      wasLocked: false,
    });
    const response = await POST(new Request('http://localhost/api/manage/public-1/session', {
      body: JSON.stringify({ pin: '0000' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }), context);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: '관리용 비밀번호가 맞지 않아요.' });
    expect(createManagePinSession).not.toHaveBeenCalled();
    expect(consumeManagePinAttempt).toHaveBeenCalledWith('book-1', expect.any(String), false, expect.any(Date));
  });

  it('트랜잭션이 이미 잠긴 시도를 반환하면 세션을 발급하지 않는다', async () => {
    verifyManagePin.mockResolvedValue(true);
    consumeManagePinAttempt.mockResolvedValueOnce({
      attempt: { failureCount: 5, lockedUntil: new Date(Date.now() + 60_000) },
      wasLocked: true,
    });
    const response = await POST(new Request('http://localhost/api/manage/public-1/session', {
      body: JSON.stringify({ pin: '1234' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }), context);

    expect(response.status).toBe(429);
    expect(createManagePinSession).not.toHaveBeenCalled();
  });

  it('다섯 번째 실패를 원자적으로 잠그고 429로 응답한다', async () => {
    verifyManagePin.mockResolvedValue(false);
    consumeManagePinAttempt.mockResolvedValueOnce({
      attempt: { failureCount: 5, lockedUntil: new Date(Date.now() + 10 * 60_000) },
      wasLocked: false,
    });

    const response = await POST(new Request('http://localhost/api/manage/public-1/session', {
      body: JSON.stringify({ pin: '0000' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }), context);

    expect(response.status).toBe(429);
    expect(createManagePinSession).not.toHaveBeenCalled();
  });
});
