import { vi } from 'vitest';

const {
  cookieGet,
  createSketchbookDeletionJob,
  findSketchbookDeletionJob,
  findSketchbookByPublicId,
  isManagePinSessionValid,
} = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  createSketchbookDeletionJob: vi.fn(),
  findSketchbookDeletionJob: vi.fn(),
  findSketchbookByPublicId: vi.fn(),
  isManagePinSessionValid: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));
vi.mock('@/lib/sketchbooks/repository', () => ({
  createSketchbookDeletionJob,
  findSketchbookDeletionJob,
  findSketchbookByPublicId,
  isManagePinSessionValid,
}));

import type { Sketchbook } from '@/lib/domain/types';
import { getManagedSketchbook, prepareSketchbookDeletion } from '@/lib/sketchbooks/management';
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
    findSketchbookDeletionJob.mockResolvedValue(null);
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

  it('삭제 시작으로 DELETED가 된 뒤에도 같은 PIN 세션은 정리 재시도를 인증한다', async () => {
    cookieGet.mockReturnValue({ value: 'public-1.session-1.secret-token' });
    findSketchbookByPublicId.mockResolvedValue({ ...sketchbook, status: 'DELETED' });

    await expect(getManagedSketchbook('public-1')).resolves.toEqual(
      expect.objectContaining({ id: 'book-1', status: 'DELETED' }),
    );

    expect(isManagePinSessionValid).toHaveBeenCalledWith('book-1', expect.objectContaining({
      sessionId: 'session-1',
      token: 'secret-token',
    }));
  });

  it('최초 삭제 권한을 삭제 대상 트리 밖 문서에 보존한 뒤 정리 정보를 반환한다', async () => {
    cookieGet.mockReturnValue({ value: 'public-1.session-1.secret-token' });

    await expect(prepareSketchbookDeletion('public-1')).resolves.toEqual({
      id: 'book-1',
      publicId: 'public-1',
      source: 'sketchbook',
    });

    expect(createSketchbookDeletionJob).toHaveBeenCalledWith(sketchbook, {
      publicId: 'public-1',
      sessionId: 'session-1',
      token: 'secret-token',
      type: 'pin',
    });
  });

  it('스케치북 루트와 세션이 없어도 일치하는 외부 삭제 권한으로 재시도를 인증한다', async () => {
    cookieGet.mockReturnValue({ value: 'public-1.session-1.secret-token' });
    findSketchbookDeletionJob.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      publicId: 'public-1',
      sessionId: 'session-1',
      sessionType: 'pin',
      sketchbookId: 'book-1',
      tokenHash: hashManageToken('secret-token'),
    });
    findSketchbookByPublicId.mockResolvedValue(null);

    await expect(prepareSketchbookDeletion('public-1')).resolves.toEqual({
      id: 'book-1',
      publicId: 'public-1',
      source: 'deletion-job',
    });

    expect(findSketchbookByPublicId).not.toHaveBeenCalled();
    expect(createSketchbookDeletionJob).not.toHaveBeenCalled();
  });

  it('외부 삭제 권한이 만료되면 루트 권한으로 우회하지 않는다', async () => {
    cookieGet.mockReturnValue({ value: 'public-1.session-1.secret-token' });
    findSketchbookDeletionJob.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1),
      publicId: 'public-1',
      sessionId: 'session-1',
      sessionType: 'pin',
      sketchbookId: 'book-1',
      tokenHash: hashManageToken('secret-token'),
    });

    await expect(prepareSketchbookDeletion('public-1')).resolves.toBeNull();

    expect(findSketchbookByPublicId).not.toHaveBeenCalled();
    expect(createSketchbookDeletionJob).not.toHaveBeenCalled();
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
