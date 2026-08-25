import { vi } from 'vitest';

const {
  cookies,
  getAdminSessionCookieName,
  isAllowedAdminOrigin,
  setDrawingModeration,
  setSketchbookModeration,
  verifyAdminSessionCookie,
} = vi.hoisted(() => ({
  cookies: vi.fn(),
  getAdminSessionCookieName: vi.fn(() => 'admin_session'),
  isAllowedAdminOrigin: vi.fn(() => true),
  setDrawingModeration: vi.fn(),
  setSketchbookModeration: vi.fn(),
  verifyAdminSessionCookie: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies }));
vi.mock('@/lib/admin/auth', () => ({
  getAdminSessionCookieName,
  verifyAdminSessionCookie,
}));
vi.mock('@/lib/admin/origin', () => ({ isAllowedAdminOrigin }));
vi.mock('@/lib/admin/moderation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/moderation')>();
  return {
    ...actual,
    setDrawingModeration,
    setSketchbookModeration,
  };
});

import { PATCH as patchDrawing } from '@/app/api/admin/sketchbooks/[sketchbookId]/drawings/[drawingId]/moderation/route';
import { PATCH as patchSketchbook } from '@/app/api/admin/sketchbooks/[sketchbookId]/moderation/route';
import { ModerationTargetNotFoundError } from '@/lib/admin/moderation';

function requestWithBody(body: unknown) {
  return new Request('http://localhost/api/admin/moderation', {
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
    },
    method: 'PATCH',
  });
}

const sketchbookContext = {
  params: Promise.resolve({ sketchbookId: 'book-1' }),
};
const drawingContext = {
  params: Promise.resolve({ drawingId: 'draw-1', sketchbookId: 'book-1' }),
};

describe('admin moderation PATCH routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookies.mockResolvedValue({
      get: vi.fn(() => ({ value: 'session-cookie' })),
    });
    getAdminSessionCookieName.mockReturnValue('admin_session');
    isAllowedAdminOrigin.mockReturnValue(true);
    verifyAdminSessionCookie.mockResolvedValue({
      email: 'owner@example.com',
      uid: 'admin-uid',
    });
    setSketchbookModeration.mockResolvedValue({ changed: true, status: 'BLOCKED' });
    setDrawingModeration.mockResolvedValue({ changed: true, status: 'BLOCKED' });
  });

  it('Origin, session, body, transaction 순으로 스케치북 상태를 변경한다', async () => {
    const order: string[] = [];
    isAllowedAdminOrigin.mockImplementation(() => {
      order.push('origin');
      return true;
    });
    verifyAdminSessionCookie.mockImplementation(async () => {
      order.push('session');
      return { email: 'owner@example.com', uid: 'admin-uid' };
    });
    setSketchbookModeration.mockImplementation(async () => {
      order.push('transaction');
      return { changed: true, status: 'BLOCKED' };
    });
    const request = requestWithBody({ moderationStatus: 'BLOCKED' });
    const originalJson = request.json.bind(request);
    vi.spyOn(request, 'json').mockImplementation(async () => {
      order.push('body');
      return originalJson();
    });

    const response = await patchSketchbook(request, sketchbookContext);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      changed: true,
      moderationStatus: 'BLOCKED',
    });
    expect(order).toEqual(['origin', 'session', 'body', 'transaction']);
    expect(verifyAdminSessionCookie).toHaveBeenCalledWith('session-cookie');
    expect(setSketchbookModeration).toHaveBeenCalledWith({
      adminUid: 'admin-uid',
      moderationStatus: 'BLOCKED',
      sketchbookId: 'book-1',
    });
  });

  it('그림 Route가 부모와 그림 식별자를 트랜잭션에 전달한다', async () => {
    setDrawingModeration.mockResolvedValue({ changed: false, status: 'ACTIVE' });

    const response = await patchDrawing(
      requestWithBody({ moderationStatus: 'ACTIVE' }),
      drawingContext,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      changed: false,
      moderationStatus: 'ACTIVE',
    });
    expect(setDrawingModeration).toHaveBeenCalledWith({
      adminUid: 'admin-uid',
      drawingId: 'draw-1',
      moderationStatus: 'ACTIVE',
      sketchbookId: 'book-1',
    });
  });

  it.each([
    { route: 'sketchbook', patch: patchSketchbook, context: sketchbookContext },
    { route: 'drawing', patch: patchDrawing, context: drawingContext },
  ])('$route Route는 허용되지 않은 Origin을 세션 확인 전에 403으로 거부한다', async ({ patch, context }) => {
    isAllowedAdminOrigin.mockReturnValue(false);

    const response = await patch(
      requestWithBody({ moderationStatus: 'BLOCKED' }),
      context as never,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ message: '허용되지 않은 요청입니다.' });
    expect(cookies).not.toHaveBeenCalled();
    expect(verifyAdminSessionCookie).not.toHaveBeenCalled();
    expect(setSketchbookModeration).not.toHaveBeenCalled();
    expect(setDrawingModeration).not.toHaveBeenCalled();
  });

  it.each([
    { route: 'sketchbook', patch: patchSketchbook, context: sketchbookContext },
    { route: 'drawing', patch: patchDrawing, context: drawingContext },
  ])('$route Route는 세션이 없으면 body를 읽지 않고 401을 반환한다', async ({ patch, context }) => {
    verifyAdminSessionCookie.mockResolvedValue(null);
    const request = requestWithBody({ moderationStatus: 'BLOCKED' });
    const json = vi.spyOn(request, 'json');

    const response = await patch(request, context as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: '관리자 로그인이 필요합니다.' });
    expect(json).not.toHaveBeenCalled();
    expect(setSketchbookModeration).not.toHaveBeenCalled();
    expect(setDrawingModeration).not.toHaveBeenCalled();
  });

  it.each([
    { body: {}, label: '필드 누락' },
    { body: { moderationStatus: 'HIDDEN' }, label: '허용되지 않은 상태' },
    { body: '{not-json', label: '잘못된 JSON' },
  ])('잘못된 스케치북 body는 transaction 없이 400을 반환한다: $label', async ({ body }) => {
    const response = await patchSketchbook(requestWithBody(body), sketchbookContext);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: '운영 상태를 확인해 주세요.' });
    expect(setSketchbookModeration).not.toHaveBeenCalled();
  });

  it.each([
    { body: {}, label: '필드 누락' },
    { body: { moderationStatus: 'HIDDEN' }, label: '허용되지 않은 상태' },
    { body: '{not-json', label: '잘못된 JSON' },
  ])('잘못된 그림 body는 transaction 없이 400을 반환한다: $label', async ({ body }) => {
    const response = await patchDrawing(requestWithBody(body), drawingContext);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: '운영 상태를 확인해 주세요.' });
    expect(setDrawingModeration).not.toHaveBeenCalled();
  });

  it.each([
    { route: 'sketchbook', patch: patchSketchbook, context: sketchbookContext, operation: setSketchbookModeration },
    { route: 'drawing', patch: patchDrawing, context: drawingContext, operation: setDrawingModeration },
  ])('$route 대상이 없으면 404를 반환한다', async ({ patch, context, operation }) => {
    operation.mockRejectedValue(new ModerationTargetNotFoundError());

    const response = await patch(
      requestWithBody({ moderationStatus: 'BLOCKED' }),
      context as never,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ message: '대상을 찾을 수 없습니다.' });
  });
});
