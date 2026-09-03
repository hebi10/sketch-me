import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cancelPayAppPayment: vi.fn(),
  cookies: vi.fn(),
  findPurchaseByOrderId: vi.fn(),
  isAllowedAdminOrigin: vi.fn(),
  markPurchaseCancelRequested: vi.fn(),
  verifyAdminSessionCookie: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: mocks.cookies }));
vi.mock('@/lib/admin/auth', () => ({
  getAdminSessionCookieName: () => 'admin-session',
  verifyAdminSessionCookie: mocks.verifyAdminSessionCookie,
}));
vi.mock('@/lib/admin/origin', () => ({ isAllowedAdminOrigin: mocks.isAllowedAdminOrigin }));
vi.mock('@/lib/payments/payapp', () => ({ cancelPayAppPayment: mocks.cancelPayAppPayment }));
vi.mock('@/lib/purchases/orders', () => ({
  findPurchaseByOrderId: mocks.findPurchaseByOrderId,
  markPurchaseCancelRequested: mocks.markPurchaseCancelRequested,
}));

import { POST } from '@/app/api/admin/payments/[orderId]/cancel/route';

describe('POST /api/admin/payments/:orderId/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAllowedAdminOrigin.mockReturnValue(true);
    mocks.cookies.mockResolvedValue({ get: () => ({ value: 'session' }) });
    mocks.verifyAdminSessionCookie.mockResolvedValue({ uid: 'admin-1' });
    mocks.findPurchaseByOrderId.mockResolvedValue({
      orderId: 'order-public-random',
      paymentStatus: 'SUCCEEDED',
      provider: 'PAYAPP',
      providerOrderId: '2000',
    });
  });

  it('성공한 페이앱 주문만 인증된 관리자가 전체 취소 요청한다', async () => {
    const response = await POST(new Request('https://sketch.example.com/api/admin/payments/order-public-random/cancel', {
      headers: { origin: 'https://sketch.example.com' },
      method: 'POST',
    }), { params: Promise.resolve({ orderId: 'order-public-random' }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cancelRequested: true });
    expect(mocks.cancelPayAppPayment).toHaveBeenCalledWith({
      cancelMemo: '관리자 전체 취소',
      providerOrderId: '2000',
    });
    expect(mocks.markPurchaseCancelRequested).toHaveBeenCalledWith('order-public-random');
  });

  it('즉시 취소가 거절되면 정산 완료 거래의 수동 절차를 안내한다', async () => {
    mocks.cancelPayAppPayment.mockRejectedValueOnce(new Error('settled payment'));

    const response = await POST(new Request('https://sketch.example.com/api/admin/payments/order-public-random/cancel', {
      headers: { origin: 'https://sketch.example.com' },
      method: 'POST',
    }), { params: Promise.resolve({ orderId: 'order-public-random' }) });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: '페이앱에서 즉시 취소할 수 없습니다. 정산 완료 여부를 확인하고 판매자 사이트에서 취소 요청해 주세요.',
    });
    expect(mocks.markPurchaseCancelRequested).not.toHaveBeenCalled();
  });

  it('Origin, 인증, 주문 상태 중 하나라도 맞지 않으면 취소하지 않는다', async () => {
    mocks.isAllowedAdminOrigin.mockReturnValueOnce(false);
    expect((await POST(new Request('https://sketch.example.com', { method: 'POST' }), {
      params: Promise.resolve({ orderId: 'order-public-random' }),
    })).status).toBe(403);

    mocks.isAllowedAdminOrigin.mockReturnValueOnce(true);
    mocks.findPurchaseByOrderId.mockResolvedValueOnce({
      paymentStatus: 'SUCCEEDED',
      provider: 'MOCK',
      providerOrderId: null,
    });
    expect((await POST(new Request('https://sketch.example.com', { method: 'POST' }), {
      params: Promise.resolve({ orderId: 'order-public-random' }),
    })).status).toBe(409);
    expect(mocks.cancelPayAppPayment).not.toHaveBeenCalled();
  });
});
