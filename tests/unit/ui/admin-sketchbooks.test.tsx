import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const {
  getAdminSketchbookDetail,
  getRequiredAdminIdentity,
  listAdminSketchbooks,
  notFound,
} = vi.hoisted(() => ({
  getAdminSketchbookDetail: vi.fn(),
  getRequiredAdminIdentity: vi.fn(),
  listAdminSketchbooks: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('@/lib/admin/repository', () => ({
  getAdminSketchbookDetail,
  listAdminSketchbooks,
}));
vi.mock('@/lib/admin/server-session', () => ({ getRequiredAdminIdentity }));
vi.mock('next/navigation', () => ({
  notFound,
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { AdminSketchbookList } from '@/app/admin/(protected)/sketchbooks/AdminSketchbookList';
import AdminSketchbookDetailPage from '@/app/admin/(protected)/sketchbooks/[sketchbookId]/page';
import AdminSketchbooksPage from '@/app/admin/(protected)/sketchbooks/page';
import { encodeAdminCursor } from '@/lib/admin/cursor';
import type {
  AdminPage,
  AdminSketchbookDetail,
  AdminSketchbookListItem,
} from '@/lib/admin/types';

const createdAt = new Date('2026-08-25T01:23:00.000Z');

function createSketchbook(
  overrides: Partial<AdminSketchbookListItem> = {},
): AdminSketchbookListItem {
  return {
    createdAt,
    entitlements: { watermarkFree: false },
    id: 'book-1',
    moderationStatus: 'ACTIVE',
    moderatedAt: null,
    name: '내 이름',
    ownerDrawingPath: 'sketchbooks/book-1/owner.webp',
    participantCount: 13,
    participantLimit: 70,
    publicId: 'public-1',
    status: 'PUBLIC',
    updatedAt: createdAt,
    ...overrides,
  } as AdminSketchbookListItem;
}

function createDetail(
  overrides: Partial<AdminSketchbookDetail> = {},
): AdminSketchbookDetail {
  return {
    ...createSketchbook(),
    purchaseSummary: { amount: 4_890, count: 2 },
    recentDrawings: [{
      authorName: '친구',
      bestRank: null,
      createdAt,
      id: 'drawing-1',
      imagePath: 'sketchbooks/book-1/drawings/drawing-1.webp',
      publicImageVersion: 'version-1',
      thumbnailPath: null,
      message: '기억해!',
      moderatedAt: null,
      moderationStatus: 'ACTIVE',
      sketchbookId: 'book-1',
      sketchbookName: '내 이름',
      sketchbookPublicId: 'public-1',
      status: 'VISIBLE',
      updatedAt: createdAt,
    }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getRequiredAdminIdentity.mockResolvedValue({
    email: 'owner@example.com',
    uid: 'admin-uid',
  });
  listAdminSketchbooks.mockResolvedValue({ items: [], nextCursor: null });
  getAdminSketchbookDetail.mockResolvedValue(createDetail());
  notFound.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
});

describe('AdminSketchbookList', () => {
  it('검색과 운영 카드, 검색어를 유지하는 다음 링크를 표시한다', () => {
    const page: AdminPage<AdminSketchbookListItem> = {
      items: [createSketchbook()],
      nextCursor: 'next-cursor',
    };

    render(<AdminSketchbookList page={page} query="내 이름" />);

    expect(screen.getByRole('searchbox', { name: '스케치북 검색' })).toHaveValue('내 이름');
    expect(screen.getByText('내 이름')).toBeVisible();
    expect(screen.getByText('public-1')).toBeVisible();
    expect(screen.getByText('13 / 70')).toBeVisible();
    expect(screen.getByText('정상')).toBeVisible();
    expect(screen.getByRole('link', { name: '내 이름 상세 보기' })).toHaveAttribute(
      'href',
      '/admin/sketchbooks/book-1',
    );
    expect(screen.getByRole('link', { name: '내 이름 공개 페이지 보기' })).toHaveAttribute(
      'href',
      '/s/public-1',
    );
    expect(screen.getByRole('link', { name: '다음 20개' })).toHaveAttribute(
      'href',
      '/admin/sketchbooks?q=%EB%82%B4+%EC%9D%B4%EB%A6%84&cursor=next-cursor',
    );
  });

  it('데이터 식별자를 안전한 경로 세그먼트로 만든다', () => {
    render(
      <AdminSketchbookList
        page={{
          items: [createSketchbook({
            id: 'book/../javascript:alert(1)',
            publicId: 'https://evil.example/a',
          })],
          nextCursor: null,
        }}
        query=""
      />,
    );

    expect(screen.getByRole('link', { name: '내 이름 상세 보기' })).toHaveAttribute(
      'href',
      '/admin/sketchbooks/book%2F..%2Fjavascript%3Aalert(1)',
    );
    expect(screen.getByRole('link', { name: '내 이름 공개 페이지 보기' })).toHaveAttribute(
      'href',
      '/s/https%3A%2F%2Fevil.example%2Fa',
    );
  });

  it('결과가 없으면 검색 조건을 유지한 빈 상태를 안내한다', () => {
    render(<AdminSketchbookList page={{ items: [], nextCursor: null }} query="없는 이름" />);

    expect(screen.getByRole('status')).toHaveTextContent('일치하는 스케치북이 없습니다.');
    expect(screen.getByRole('searchbox', { name: '스케치북 검색' })).toHaveValue('없는 이름');
    expect(screen.queryByRole('link', { name: '다음 20개' })).not.toBeInTheDocument();
  });
});

describe('AdminSketchbooksPage 데이터 경계', () => {
  it('페이지 인증이 거부되면 목록 저장소를 호출하지 않는다', async () => {
    getRequiredAdminIdentity.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(AdminSketchbooksPage({ searchParams: Promise.resolve({}) }))
      .rejects.toThrow('NEXT_REDIRECT');

    expect(listAdminSketchbooks).not.toHaveBeenCalled();
  });

  it('검색어를 정규화하고 100자로 제한한 뒤 인증 직후 조회한다', async () => {
    const longQuery = `  ${'가'.repeat(120)}  `;

    render(await AdminSketchbooksPage({
      searchParams: Promise.resolve({ ignored: 'value', q: longQuery }),
    }));

    expect(getRequiredAdminIdentity).toHaveBeenCalledTimes(1);
    expect(listAdminSketchbooks).toHaveBeenCalledWith({
      cursor: undefined,
      query: '가'.repeat(100),
    });
    expect(getRequiredAdminIdentity.mock.invocationCallOrder[0])
      .toBeLessThan(listAdminSketchbooks.mock.invocationCallOrder[0]);
    expect(screen.getByRole('searchbox', { name: '스케치북 검색' })).toHaveValue('가'.repeat(100));
  });

  it('유효한 스케치북 커서를 인증 직후 저장소에 전달한다', async () => {
    const cursor = encodeAdminCursor({
      createdAt: '2026-08-25T00:00:00.000Z',
      path: 'sketchbooks/book-20',
    });

    render(await AdminSketchbooksPage({
      searchParams: Promise.resolve({ cursor, q: '  내 이름  ' }),
    }));

    expect(listAdminSketchbooks).toHaveBeenCalledWith({ cursor, query: '내 이름' });
    expect(getRequiredAdminIdentity.mock.invocationCallOrder[0])
      .toBeLessThan(listAdminSketchbooks.mock.invocationCallOrder[0]);
  });

  it('잘못된 커서는 첫 페이지로 바꾸지 않고 접근 가능한 오류로 알린다', async () => {
    render(await AdminSketchbooksPage({
      searchParams: Promise.resolve({ cursor: 'not-a-cursor', q: '  내 이름  ' }),
    }));

    expect(getRequiredAdminIdentity).toHaveBeenCalledTimes(1);
    expect(listAdminSketchbooks).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('페이지 위치 정보가 잘못되었습니다.');
    expect(screen.getByRole('link', { name: '검색 첫 페이지로 돌아가기' })).toHaveAttribute(
      'href',
      '/admin/sketchbooks?q=%EB%82%B4+%EC%9D%B4%EB%A6%84',
    );
  });

  it('배열 커서나 허용된 길이를 넘는 커서를 거부한다', async () => {
    render(await AdminSketchbooksPage({
      searchParams: Promise.resolve({ cursor: ['one', 'two'] }),
    }));

    expect(screen.getByRole('alert')).toBeVisible();
    expect(listAdminSketchbooks).not.toHaveBeenCalled();

    vi.clearAllMocks();
    getRequiredAdminIdentity.mockResolvedValue({
      email: 'owner@example.com',
      uid: 'admin-uid',
    });

    render(await AdminSketchbooksPage({
      searchParams: Promise.resolve({ cursor: 'a'.repeat(2_049) }),
    }));

    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(listAdminSketchbooks).not.toHaveBeenCalled();
  });

  it('스케치북 컬렉션 아래 정확히 한 문서가 아닌 중첩 커서를 거부한다', async () => {
    const nestedCursor = encodeAdminCursor({
      createdAt: '2026-08-25T00:00:00.000Z',
      path: 'users/user-1/sketchbooks/book-20',
    });

    render(await AdminSketchbooksPage({
      searchParams: Promise.resolve({ cursor: nestedCursor }),
    }));

    expect(screen.getByRole('alert')).toHaveTextContent('페이지 위치 정보가 잘못되었습니다.');
    expect(listAdminSketchbooks).not.toHaveBeenCalled();
  });
});

describe('AdminSketchbookDetailPage 데이터 경계', () => {
  it('페이지 인증이 거부되면 상세 저장소를 호출하지 않는다', async () => {
    getRequiredAdminIdentity.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(AdminSketchbookDetailPage({
      params: Promise.resolve({ sketchbookId: 'book-1' }),
    })).rejects.toThrow('NEXT_REDIRECT');

    expect(getAdminSketchbookDetail).not.toHaveBeenCalled();
  });

  it('인증 직후 상세를 읽고 기본 정보와 최근 활동을 표시한다', async () => {
    render(await AdminSketchbookDetailPage({
      params: Promise.resolve({ sketchbookId: 'book-1' }),
    }));

    expect(getRequiredAdminIdentity).toHaveBeenCalledTimes(1);
    expect(getAdminSketchbookDetail).toHaveBeenCalledWith('book-1');
    expect(getRequiredAdminIdentity.mock.invocationCallOrder[0])
      .toBeLessThan(getAdminSketchbookDetail.mock.invocationCallOrder[0]);
    expect(screen.getByRole('heading', { name: '내 이름' })).toBeVisible();
    expect(screen.getByText('13 / 70')).toBeVisible();
    expect(screen.getByText('생성자 그림 있음')).toBeVisible();
    expect(screen.getByText('친구')).toBeVisible();
    expect(screen.getByText('2건')).toBeVisible();
    expect(screen.getByText('4,890원')).toBeVisible();
    expect(screen.getByRole('button', { name: '서비스에서 비활성화' })).toBeVisible();
    expect(screen.getByRole('link', { name: '공개 페이지 보기' })).toHaveAttribute('href', '/s/public-1');
  });

  it('상세가 없으면 404로 응답한다', async () => {
    getAdminSketchbookDetail.mockResolvedValue(null);

    await expect(AdminSketchbookDetailPage({
      params: Promise.resolve({ sketchbookId: 'missing-book' }),
    })).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('공개 ID를 외부 URL로 실행할 수 없는 내부 경로로 만든다', async () => {
    getAdminSketchbookDetail.mockResolvedValue(createDetail({
      publicId: 'javascript:alert(1)/../x',
    }));

    render(await AdminSketchbookDetailPage({
      params: Promise.resolve({ sketchbookId: 'book-1' }),
    }));

    expect(screen.getByRole('link', { name: '공개 페이지 보기' })).toHaveAttribute(
      'href',
      '/s/javascript%3Aalert(1)%2F..%2Fx',
    );
  });
});
