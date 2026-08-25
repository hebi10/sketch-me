import { render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';

const {
  getRequiredAdminIdentity,
  listAdminPurchases,
} = vi.hoisted(() => ({
  getRequiredAdminIdentity: vi.fn(),
  listAdminPurchases: vi.fn(),
}));

vi.mock('@/lib/admin/repository', () => ({ listAdminPurchases }));
vi.mock('@/lib/admin/server-session', () => ({ getRequiredAdminIdentity }));

import { AdminPaymentList } from '@/app/admin/(protected)/payments/AdminPaymentList';
import AdminPaymentsPage from '@/app/admin/(protected)/payments/page';
import { encodeAdminCursor } from '@/lib/admin/cursor';
import type {
  AdminPage,
  AdminPurchaseListItem,
} from '@/lib/admin/types';

const createdAt = new Date('2026-08-25T01:23:00.000Z');

function createPurchase(
  overrides: Partial<AdminPurchaseListItem> = {},
): AdminPurchaseListItem {
  return {
    additionalLimit: 50,
    amount: 3_900,
    createdAt,
    id: 'purchase-1',
    orderId: 'mock_order_1',
    paidAt: createdAt,
    paymentStatus: 'SUCCEEDED',
    productType: 'FRIENDS_50',
    provider: 'MOCK',
    sketchbookId: 'book-1',
    sketchbookName: '내 이름',
    sketchbookPublicId: 'public-1',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getRequiredAdminIdentity.mockResolvedValue({
    email: 'owner@example.com',
    uid: 'admin-uid',
  });
  listAdminPurchases.mockResolvedValue({ items: [], nextCursor: null });
});

describe('AdminPaymentList', () => {
  it('모의 결제임과 조회 전용임을 화면과 카드에서 명확히 표시한다', () => {
    const page: AdminPage<AdminPurchaseListItem> = {
      items: [createPurchase()],
      nextCursor: null,
    };

    render(<AdminPaymentList page={page} />);

    expect(screen.getByRole('heading', { name: '모의 결제 목록' })).toBeVisible();
    expect(screen.getByText(/조회 전용/)).toBeVisible();
    const card = screen.getByRole('article', { name: 'mock_order_1 결제' });
    expect(within(card).getByText('모의 결제')).toBeVisible();
    expect(within(card).getByText('내 이름')).toBeVisible();
    expect(within(card).getByText('public-1')).toBeVisible();
    expect(within(card).getByText('FRIENDS_50')).toBeVisible();
    expect(within(card).getByText('+50명')).toBeVisible();
    expect(within(card).getByText('3,900원')).toBeVisible();
    expect(within(card).getByText('성공')).toBeVisible();
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  });

  it('커서를 인코딩한 다음 20개 링크와 빈 상태를 표시한다', () => {
    const { rerender } = render(
      <AdminPaymentList page={{ items: [], nextCursor: 'next+/= cursor' }} />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('아직 모의 결제 내역이 없습니다.');
    expect(screen.getByRole('link', { name: '다음 20개' })).toHaveAttribute(
      'href',
      '/admin/payments?cursor=next%2B%2F%3D+cursor',
    );

    rerender(<AdminPaymentList page={{ items: [], nextCursor: null }} />);
    expect(screen.queryByRole('link', { name: '다음 20개' })).not.toBeInTheDocument();
  });
});

describe('AdminPaymentsPage 데이터 경계', () => {
  it('페이지 인증이 거부되면 결제 저장소를 호출하지 않는다', async () => {
    getRequiredAdminIdentity.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(AdminPaymentsPage({ searchParams: Promise.resolve({}) }))
      .rejects.toThrow('NEXT_REDIRECT');

    expect(listAdminPurchases).not.toHaveBeenCalled();
  });

  it('정확한 스케치북 하위 결제 커서를 인증 직후 저장소에 전달한다', async () => {
    const cursor = encodeAdminCursor({
      createdAt: '2026-08-25T00:00:00.000Z',
      path: 'sketchbooks/book-1/purchases/purchase-20',
    });

    render(await AdminPaymentsPage({
      searchParams: Promise.resolve({ cursor, ignored: 'value' }),
    }));

    expect(listAdminPurchases).toHaveBeenCalledWith({ cursor });
    expect(getRequiredAdminIdentity.mock.invocationCallOrder[0])
      .toBeLessThan(listAdminPurchases.mock.invocationCallOrder[0]);
  });

  it.each([
    'not-a-cursor',
    encodeAdminCursor({
      createdAt: '2026-08-25T00:00:00.000Z',
      path: 'users/user-1/purchases/purchase-20',
    }),
    encodeAdminCursor({
      createdAt: '2026-08-25T00:00:00.000Z',
      path: 'sketchbooks/book-1/drawings/purchase-20',
    }),
    encodeAdminCursor({
      createdAt: '2026-08-25T00:00:00.000Z',
      path: 'sketchbooks/book-1/purchases/nested/purchase-20',
    }),
  ])('잘못된 전체 결제 경로 커서는 명시적 오류를 표시하고 저장소를 호출하지 않는다', async (cursor) => {
    render(await AdminPaymentsPage({ searchParams: Promise.resolve({ cursor }) }));

    expect(screen.getByRole('alert')).toHaveTextContent('페이지 위치 정보가 잘못되었습니다.');
    expect(screen.getByRole('link', { name: '결제 첫 페이지로 돌아가기' })).toHaveAttribute(
      'href',
      '/admin/payments',
    );
    expect(listAdminPurchases).not.toHaveBeenCalled();
  });
});
