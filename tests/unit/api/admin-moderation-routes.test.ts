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
const exactUtf8LimitId = '가'.repeat(500);
const oversizedUtf8Id = '가'.repeat(501);

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

  afterEach(() => {
    vi.restoreAllMocks();
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
    { route: 'sketchbook', patch: patchSketchbook, context: sketchbookContext },
    { route: 'drawing', patch: patchDrawing, context: drawingContext },
  ])('$route Route는 세션 쿠키가 누락되면 401을 반환한다', async ({ patch, context }) => {
    cookies.mockResolvedValue({ get: vi.fn(() => undefined) });
    verifyAdminSessionCookie.mockImplementation(async (cookieValue?: string) => (
      cookieValue
        ? { email: 'owner@example.com', uid: 'admin-uid' }
        : null
    ));

    const response = await patch(
      requestWithBody({ moderationStatus: 'BLOCKED' }),
      context as never,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: '관리자 로그인이 필요합니다.' });
    expect(verifyAdminSessionCookie).toHaveBeenCalledWith(undefined);
    expect(setSketchbookModeration).not.toHaveBeenCalled();
    expect(setDrawingModeration).not.toHaveBeenCalled();
  });

  it.each([
    { body: {}, label: '필드 누락' },
    { body: { moderationStatus: 'HIDDEN' }, label: '허용되지 않은 상태' },
    { body: { moderationStatus: 'BLOCKED', unexpected: true }, label: '추가 필드' },
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
    { body: { moderationStatus: 'BLOCKED', unexpected: true }, label: '추가 필드' },
    { body: '{not-json', label: '잘못된 JSON' },
  ])('잘못된 그림 body는 transaction 없이 400을 반환한다: $label', async ({ body }) => {
    const response = await patchDrawing(requestWithBody(body), drawingContext);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: '운영 상태를 확인해 주세요.' });
    expect(setDrawingModeration).not.toHaveBeenCalled();
  });

  it.each([
    { label: '빈 ID', sketchbookId: '' },
    { label: '인코딩된 slash가 decode된 ID', sketchbookId: 'book/escape' },
    { label: '한 개 점 ID', sketchbookId: '.' },
    { label: '두 개 점 ID', sketchbookId: '..' },
    { label: 'UTF-8 1,500 bytes 초과 ID', sketchbookId: oversizedUtf8Id },
  ])('스케치북의 $label는 moderation 호출 전 400으로 거부한다', async ({ sketchbookId }) => {
    const response = await patchSketchbook(
      requestWithBody({ moderationStatus: 'BLOCKED' }),
      { params: Promise.resolve({ sketchbookId }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: '요청을 확인해 주세요.' });
    expect(setSketchbookModeration).not.toHaveBeenCalled();
    expect(setDrawingModeration).not.toHaveBeenCalled();
  });

  it.each([
    { drawingId: 'draw-1', label: '부모의 빈 ID', sketchbookId: '' },
    { drawingId: 'draw-1', label: '부모의 decode된 slash ID', sketchbookId: 'book/escape' },
    { drawingId: '', label: '그림의 빈 ID', sketchbookId: 'book-1' },
    { drawingId: 'draw/escape', label: '그림의 decode된 slash ID', sketchbookId: 'book-1' },
    { drawingId: '.', label: '그림의 한 개 점 ID', sketchbookId: 'book-1' },
    { drawingId: '..', label: '그림의 두 개 점 ID', sketchbookId: 'book-1' },
    { drawingId: oversizedUtf8Id, label: '그림의 UTF-8 1,500 bytes 초과 ID', sketchbookId: 'book-1' },
  ])('그림 $label는 moderation 호출 전 400으로 거부한다', async ({ drawingId, sketchbookId }) => {
    const response = await patchDrawing(
      requestWithBody({ moderationStatus: 'BLOCKED' }),
      { params: Promise.resolve({ drawingId, sketchbookId }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: '요청을 확인해 주세요.' });
    expect(setSketchbookModeration).not.toHaveBeenCalled();
    expect(setDrawingModeration).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'backslash와 % ID', sketchbookId: 'book\\valid%25' },
    { label: 'UTF-8 정확히 1,500 bytes ID', sketchbookId: exactUtf8LimitId },
  ])('스케치북의 유효한 $label를 원문 그대로 moderation에 전달한다', async ({ sketchbookId }) => {
    const response = await patchSketchbook(
      requestWithBody({ moderationStatus: 'BLOCKED' }),
      { params: Promise.resolve({ sketchbookId }) },
    );

    expect(response.status).toBe(200);
    expect(setSketchbookModeration).toHaveBeenCalledWith({
      adminUid: 'admin-uid',
      moderationStatus: 'BLOCKED',
      sketchbookId,
    });
  });

  it.each([
    {
      drawingId: 'draw\\valid%2F',
      label: 'backslash와 % ID',
      sketchbookId: 'book\\valid%25',
    },
    {
      drawingId: exactUtf8LimitId,
      label: 'UTF-8 정확히 1,500 bytes ID',
      sketchbookId: exactUtf8LimitId,
    },
  ])('그림의 유효한 $label를 원문 그대로 moderation에 전달한다', async ({
    drawingId,
    sketchbookId,
  }) => {
    const response = await patchDrawing(
      requestWithBody({ moderationStatus: 'BLOCKED' }),
      { params: Promise.resolve({ drawingId, sketchbookId }) },
    );

    expect(response.status).toBe(200);
    expect(setDrawingModeration).toHaveBeenCalledWith({
      adminUid: 'admin-uid',
      drawingId,
      moderationStatus: 'BLOCKED',
      sketchbookId,
    });
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

  it.each([
    {
      context: sketchbookContext,
      label: 'sketchbook',
      logMessage: 'Admin sketchbook moderation failed',
      operation: setSketchbookModeration,
      patch: patchSketchbook,
    },
    {
      context: drawingContext,
      label: 'drawing',
      logMessage: 'Admin drawing moderation failed',
      operation: setDrawingModeration,
      patch: patchDrawing,
    },
  ])('$label 내부 오류는 비밀값 없는 generic 500으로 변환한다', async ({
    context,
    logMessage,
    operation,
    patch,
  }) => {
    const secret = 'firebase unavailable: secret-token';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    operation.mockRejectedValue(new Error(secret));

    const response = await patch(
      requestWithBody({ moderationStatus: 'BLOCKED' }),
      context as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ message: '운영 상태를 변경하지 못했습니다.' });
    expect(JSON.stringify(payload)).not.toContain(secret);
    expect(consoleError).toHaveBeenCalledWith(logMessage, 'Error');
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain(secret);
  });
});
