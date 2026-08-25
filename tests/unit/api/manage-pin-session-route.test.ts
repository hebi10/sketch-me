import { vi } from 'vitest';

const {
  createManagePinSession,
  findSketchbookByPublicId,
  getManagePinAttempt,
  saveManagePinAttempt,
  verifyManagePin,
} = vi.hoisted(() => ({
  createManagePinSession: vi.fn(),
  findSketchbookByPublicId: vi.fn(),
  getManagePinAttempt: vi.fn(),
  saveManagePinAttempt: vi.fn(),
  verifyManagePin: vi.fn(),
}));

vi.mock('@/lib/sketchbooks/manage-pin', () => ({ verifyManagePin }));
vi.mock('@/lib/sketchbooks/repository', () => ({
  createManagePinSession,
  findSketchbookByPublicId,
  getManagePinAttempt,
  saveManagePinAttempt,
}));

import { POST } from '@/app/api/manage/[publicId]/session/route';

const sketchbook = { id: 'book-1', managePinHash: 'scrypt$salt$hash' };
const context = { params: Promise.resolve({ publicId: 'public-1' }) };

describe('POST /api/manage/:publicId/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSketchbookByPublicId.mockResolvedValue(sketchbook);
    getManagePinAttempt.mockResolvedValue(null);
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
    expect(saveManagePinAttempt).toHaveBeenCalledWith('book-1', expect.any(String), { failureCount: 0, lockedUntil: null });
    expect(response.headers.get('set-cookie')).toContain('sketchbook_manage_token=public-1.session-1.secret-token');
  });

  it('잘못된 PIN을 저장하되 세션은 발급하지 않는다', async () => {
    verifyManagePin.mockResolvedValue(false);
    const response = await POST(new Request('http://localhost/api/manage/public-1/session', {
      body: JSON.stringify({ pin: '0000' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }), context);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: '관리 비밀번호가 맞지 않아요.' });
    expect(createManagePinSession).not.toHaveBeenCalled();
    expect(saveManagePinAttempt).toHaveBeenCalledWith('book-1', expect.any(String), { failureCount: 1, lockedUntil: null });
  });

  it('잠긴 시도는 PIN 검증 전 거절한다', async () => {
    getManagePinAttempt.mockResolvedValue({ failureCount: 5, lockedUntil: new Date(Date.now() + 60_000) });
    const response = await POST(new Request('http://localhost/api/manage/public-1/session', {
      body: JSON.stringify({ pin: '1234' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }), context);

    expect(response.status).toBe(429);
    expect(verifyManagePin).not.toHaveBeenCalled();
    expect(saveManagePinAttempt).not.toHaveBeenCalled();
  });
});
