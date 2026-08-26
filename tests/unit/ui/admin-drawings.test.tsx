import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';

const {
  getRequiredAdminIdentity,
  listAdminDrawings,
  refresh,
} = vi.hoisted(() => ({
  getRequiredAdminIdentity: vi.fn(),
  listAdminDrawings: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/lib/admin/repository', () => ({ listAdminDrawings }));
vi.mock('@/lib/admin/server-session', () => ({ getRequiredAdminIdentity }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

import { AdminDrawingList } from '@/app/admin/(protected)/drawings/AdminDrawingList';
import { DrawingModerationButton } from '@/app/admin/(protected)/drawings/DrawingModerationButton';
import AdminDrawingsPage from '@/app/admin/(protected)/drawings/page';
import { encodeAdminCursor } from '@/lib/admin/cursor';
import type {
  AdminDrawingListItem,
  AdminPage,
} from '@/lib/admin/types';

const createdAt = new Date('2026-08-25T01:23:00.000Z');

function createDrawing(
  overrides: Partial<AdminDrawingListItem> = {},
): AdminDrawingListItem {
  return {
    authorName: '친구1',
    bestRank: null,
    createdAt,
    id: 'draw-1',
    imagePath: 'sketchbooks/book-1/drawings/draw-1/original.webp',
    publicImageVersion: 'version-1',
    thumbnailPath: 'sketchbooks/book-1/drawings/draw-1/thumbnail.webp',
    message: '기억해!',
    moderatedAt: null,
    moderationStatus: 'ACTIVE',
    sketchbookId: 'book-1',
    sketchbookName: '내 이름',
    sketchbookPublicId: 'public-1',
    status: 'VISIBLE',
    updatedAt: createdAt,
    usedReferenceImage: false,
    ...overrides,
  } as AdminDrawingListItem;
}

function createDeferred<T>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  getRequiredAdminIdentity.mockResolvedValue({
    email: 'owner@example.com',
    uid: 'admin-uid',
  });
  listAdminDrawings.mockResolvedValue({ items: [], nextCursor: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AdminDrawingList', () => {
  it('보호 API의 원본 이미지를 최적화 캐시 없이 표시하고 소유자·운영 상태를 함께 설명한다', () => {
    const page: AdminPage<AdminDrawingListItem> = {
      items: [
        createDrawing(),
        createDrawing({
          authorName: '친구2',
          id: 'draw-2',
          moderationStatus: 'BLOCKED',
          status: 'HIDDEN',
        }),
      ],
      nextCursor: null,
    };

    render(<AdminDrawingList page={page} />);

    const firstCard = screen.getByRole('article', { name: '친구1님의 그림' });
    expect(within(firstCard).getByRole('img', { name: '친구1님의 그림' })).toHaveAttribute(
      'src',
      '/api/admin/sketchbooks/book-1/drawings/draw-1/image',
    );
    expect(within(firstCard).getByText('내 이름')).toBeVisible();
    expect(within(firstCard).getByText('public-1')).toBeVisible();
    expect(within(firstCard).getByText('소유자 공개')).toBeVisible();
    expect(within(firstCard).getAllByText('운영 정상')).toHaveLength(2);

    const secondCard = screen.getByRole('article', { name: '친구2님의 그림' });
    expect(within(secondCard).getByText('소유자 숨김')).toBeVisible();
    expect(within(secondCard).getAllByText('운영자 숨김')).toHaveLength(2);
    expect(within(secondCard).getByRole('button', { name: '숨김 해제' })).toBeVisible();
  });

  it('커서를 URLSearchParams로 인코딩한 다음 20개 링크를 표시한다', () => {
    render(<AdminDrawingList page={{ items: [], nextCursor: 'next+/= cursor' }} />);

    expect(screen.getByRole('link', { name: '다음 20개' })).toHaveAttribute(
      'href',
      '/admin/drawings?cursor=next%2B%2F%3D+cursor',
    );
  });

  it('그림이 없으면 운영 맥락을 설명하는 빈 상태를 표시한다', () => {
    render(<AdminDrawingList page={{ items: [], nextCursor: null }} />);

    expect(screen.getByRole('status')).toHaveTextContent('검토할 친구 그림이 없습니다.');
  });
});

describe('AdminDrawingsPage 데이터 경계', () => {
  it('페이지 인증이 거부되면 그림 저장소를 호출하지 않는다', async () => {
    getRequiredAdminIdentity.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(AdminDrawingsPage({ searchParams: Promise.resolve({}) }))
      .rejects.toThrow('NEXT_REDIRECT');

    expect(listAdminDrawings).not.toHaveBeenCalled();
  });

  it('정확한 스케치북 하위 그림 커서를 인증 직후 저장소에 전달한다', async () => {
    const cursor = encodeAdminCursor({
      createdAt: '2026-08-25T00:00:00.000Z',
      path: 'sketchbooks/book-1/drawings/draw-20',
    });

    render(await AdminDrawingsPage({
      searchParams: Promise.resolve({ cursor, ignored: 'value' }),
    }));

    expect(listAdminDrawings).toHaveBeenCalledWith({ cursor });
    expect(getRequiredAdminIdentity.mock.invocationCallOrder[0])
      .toBeLessThan(listAdminDrawings.mock.invocationCallOrder[0]);
  });

  it.each([
    'not-a-cursor',
    encodeAdminCursor({
      createdAt: '2026-08-25T00:00:00.000Z',
      path: 'users/user-1/drawings/draw-20',
    }),
    encodeAdminCursor({
      createdAt: '2026-08-25T00:00:00.000Z',
      path: 'sketchbooks/book-1/purchases/draw-20',
    }),
    encodeAdminCursor({
      createdAt: '2026-08-25T00:00:00.000Z',
      path: 'sketchbooks/book-1/drawings/nested/draw-20',
    }),
  ])('잘못된 전체 그림 경로 커서는 명시적 오류를 표시하고 저장소를 호출하지 않는다', async (cursor) => {
    render(await AdminDrawingsPage({ searchParams: Promise.resolve({ cursor }) }));

    expect(screen.getByRole('alert')).toHaveTextContent('페이지 위치 정보가 잘못되었습니다.');
    expect(screen.getByRole('link', { name: '그림 첫 페이지로 돌아가기' })).toHaveAttribute(
      'href',
      '/admin/drawings',
    );
    expect(listAdminDrawings).not.toHaveBeenCalled();
  });
});

describe('DrawingModerationButton', () => {
  it('공용 대화상자의 위험 변형으로 정확한 BLOCKED PATCH를 보내고 목록을 새로고침한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <DrawingModerationButton
        drawingId="draw-1"
        moderationStatus="ACTIVE"
        sketchbookId="book-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '서비스에서 숨기기' }));
    expect(screen.getByRole('dialog', { name: '그림을 숨길까요?' })).toBeVisible();
    const confirm = screen.getByRole('button', { name: '숨기기' });
    expect(confirm).toHaveClass('button--danger');
    fireEvent.click(confirm);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/sketchbooks/book-1/drawings/draw-1/moderation',
      {
        body: JSON.stringify({ moderationStatus: 'BLOCKED' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
        signal: expect.any(AbortSignal),
      },
    ));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('운영자 숨김 그림은 공용 대화상자의 primary 변형과 ACTIVE payload를 사용한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <DrawingModerationButton
        drawingId="draw-1"
        moderationStatus="BLOCKED"
        sketchbookId="book-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '숨김 해제' }));
    const confirm = screen.getByRole('button', { name: '숨김 해제하기' });
    expect(screen.getByRole('dialog', { name: '그림 숨김을 해제할까요?' })).toBeVisible();
    expect(confirm).toHaveClass('button--primary');
    fireEvent.click(confirm);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/sketchbooks/book-1/drawings/draw-1/moderation',
      expect.objectContaining({
        body: JSON.stringify({ moderationStatus: 'ACTIVE' }),
        method: 'PATCH',
      }),
    ));
  });

  it('Escape로 닫으면 실행 버튼에 포커스를 복귀시킨다', () => {
    render(
      <DrawingModerationButton
        drawingId="draw-1"
        moderationStatus="ACTIVE"
        sketchbookId="book-1"
      />,
    );
    const trigger = screen.getByRole('button', { name: '서비스에서 숨기기' });
    fireEvent.click(trigger);

    expect(screen.getByRole('button', { name: '상태 변경 닫기' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('요청 중 unmount하면 요청을 중단하고 늦은 응답을 무시한다', async () => {
    const deferred = createDeferred<{ ok: boolean }>();
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_input, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return deferred.promise;
    }));
    const view = render(
      <DrawingModerationButton
        drawingId="draw-1"
        moderationStatus="ACTIVE"
        sketchbookId="book-1"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '서비스에서 숨기기' }));
    fireEvent.click(screen.getByRole('button', { name: '숨기기' }));

    await waitFor(() => expect(requestSignal).toBeDefined());
    view.unmount();
    expect(requestSignal?.aborted).toBe(true);

    await act(async () => {
      deferred.resolve({ ok: true });
      await deferred.promise;
      await Promise.resolve();
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it('non-2xx 오류는 일반 alert로 표시하고 dialog와 확인 포커스를 유지한 뒤 재시도한다', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({ message: 'SECRET_TOKEN=top-secret' }),
        ok: false,
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <DrawingModerationButton
        drawingId="draw-1"
        moderationStatus="ACTIVE"
        sketchbookId="book-1"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '서비스에서 숨기기' }));
    const confirm = screen.getByRole('button', { name: '숨기기' });

    fireEvent.click(confirm);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    expect(alert).not.toHaveTextContent('SECRET_TOKEN');
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(confirm).toHaveFocus());

    fireEvent.click(confirm);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('네트워크 오류도 일반 alert와 확인 포커스를 유지하고 재시도 성공을 허용한다', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('PRIVATE_FIREBASE_PROJECT'))
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <DrawingModerationButton
        drawingId="draw-1"
        moderationStatus="ACTIVE"
        sketchbookId="book-1"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '서비스에서 숨기기' }));
    const confirm = screen.getByRole('button', { name: '숨기기' });

    fireEvent.click(confirm);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    expect(alert).not.toHaveTextContent('PRIVATE_FIREBASE_PROJECT');
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(confirm).toHaveFocus());

    fireEvent.click(confirm);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
