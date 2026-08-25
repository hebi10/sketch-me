import { vi } from 'vitest';

const {
  cookieGet,
  findSketchbookByPublicId,
  isManagePinSessionValid,
} = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  findSketchbookByPublicId: vi.fn(),
  isManagePinSessionValid: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));
vi.mock('@/lib/sketchbooks/repository', () => ({
  findSketchbookByPublicId,
  isManagePinSessionValid,
}));

import type { Sketchbook } from '@/lib/domain/types';
import { getManagedSketchbook } from '@/lib/sketchbooks/management';
import { hashManageToken } from '@/lib/sketchbooks/manage-session';

const createdAt = new Date('2026-08-25T00:00:00.000Z');
const sketchbook: Sketchbook = {
  createdAt,
  id: 'book-1',
  managePinEnabledAt: createdAt,
  managePinHash: 'scrypt$salt$hash',
  managePinHint: null,
  manageTokenHash: hashManageToken('legacy-token'),
  moderatedAt: null,
  moderationStatus: 'ACTIVE',
  name: '내 이름',
  ownerDrawingPath: 'sketchbooks/book-1/owner/original.webp',
  participantCount: 0,
  participantLimit: 20,
  publicId: 'public-1',
  referenceImageEnabled: false,
  referenceImagePath: null,
  status: 'PUBLIC',
  updatedAt: createdAt,
};

describe('getManagedSketchbook 관리 세션 선행 검증', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSketchbookByPublicId.mockResolvedValue(sketchbook);
    isManagePinSessionValid.mockResolvedValue(true);
  });

  it.each([
    { cookieValue: undefined, label: '쿠키 부재', publicId: 'public-1' },
    { cookieValue: 'malformed', label: '쿠키 형식 오류', publicId: 'public-1' },
    { cookieValue: 'other-public.session-1.secret-token', label: 'publicId 불일치', publicId: 'public-1' },
  ])('$label는 Firestore를 전혀 읽지 않는다', async ({ cookieValue, publicId }) => {
    cookieGet.mockReturnValue(cookieValue ? { value: cookieValue } : undefined);

    await expect(getManagedSketchbook(publicId)).resolves.toBeNull();

    expect(findSketchbookByPublicId).not.toHaveBeenCalled();
    expect(isManagePinSessionValid).not.toHaveBeenCalled();
  });

  it('publicId가 일치하는 PIN 후보만 문서를 읽고 세션을 검증한다', async () => {
    cookieGet.mockReturnValue({ value: 'public-1.session-1.secret-token' });

    await expect(getManagedSketchbook('public-1')).resolves.toBe(sketchbook);

    expect(findSketchbookByPublicId).toHaveBeenCalledTimes(1);
    expect(findSketchbookByPublicId).toHaveBeenCalledWith('public-1');
    expect(isManagePinSessionValid).toHaveBeenCalledWith('book-1', {
      publicId: 'public-1',
      sessionId: 'session-1',
      token: 'secret-token',
      type: 'pin',
    });
  });

  it('publicId가 일치하는 legacy 후보는 기존 토큰 해시를 검증한다', async () => {
    cookieGet.mockReturnValue({ value: 'public-1.legacy-token' });
    findSketchbookByPublicId.mockResolvedValue({ ...sketchbook, managePinHash: null });

    await expect(getManagedSketchbook('public-1')).resolves.toEqual(
      expect.objectContaining({ id: 'book-1' }),
    );

    expect(findSketchbookByPublicId).toHaveBeenCalledWith('public-1');
    expect(isManagePinSessionValid).not.toHaveBeenCalled();
  });
});
