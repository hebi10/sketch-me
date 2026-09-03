import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  attachProviderPayment: vi.fn(),
  createPendingPurchase: vi.fn(),
  failPendingPurchase: vi.fn(),
  getManagedSketchbook: vi.fn(),
  requestPayAppPayment: vi.fn(),
}));

vi.mock('@/lib/sketchbooks/management', () => ({ getManagedSketchbook: mocks.getManagedSketchbook }));
vi.mock('@/lib/purchases/orders', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/purchases/orders')>(),
  attachProviderPayment: mocks.attachProviderPayment,
  createPendingPurchase: mocks.createPendingPurchase,
  failPendingPurchase: mocks.failPendingPurchase,
}));
vi.mock('@/lib/payments/payapp', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/payments/payapp')>(),
  requestPayAppPayment: mocks.requestPayAppPayment,
}));

import { POST } from '@/app/api/manage/[publicId]/purchase/route';
import { PurchaseConflictError } from '@/lib/purchases/orders';

const sketchbook = {
  entitlements: { watermarkFree: false },
  id: 'book-1',
  name: '내 이름',
  participantLimit: 20,
  publicId: 'public-1',
};

function paymentRequest(body: Record<string, unknown>) {
  return new Request('https://sketch.example.com/api/manage/public-1/purchase', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

describe('POST /api/manage/:publicId/purchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getManagedSketchbook.mockResolvedValue(sketchbook);
    mocks.failPendingPurchase.mockResolvedValue(undefined);
    mocks.createPendingPurchase.mockResolvedValue({
      isNew: true,
      orderId: 'order-public-random',
      paymentStatus: 'READY',
      providerOrderId: null,
    });
    mocks.requestPayAppPayment.mockResolvedValue({
      payUrl: 'https://payapp.kr/pay/2000',
      providerOrderId: '2000',
    });
  });

  it('결제 요청만으로 혜택을 적용하지 않고 페이앱 URL을 반환한다', async () => {
    const response = await POST(paymentRequest({
      buyerPhone: '010-1234-5678',
      productId: 'FRIENDS_10',
      requestId: 'request-1234',
    }), { params: Promise.resolve({ publicId: 'public-1' }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      orderId: 'order-public-random',
      payUrl: 'https://payapp.kr/pay/2000',
    });
    expect(mocks.createPendingPurchase).toHaveBeenCalledWith(expect.objectContaining({
      buyerPhone: '01012345678',
      plan: expect.objectContaining({ amount: 1000, productId: 'FRIENDS_10' }),
      requestId: 'request-1234',
      sketchbook,
    }));
    expect(mocks.attachProviderPayment).toHaveBeenCalledWith({
      orderId: 'order-public-random',
      payUrl: 'https://payapp.kr/pay/2000',
      providerOrderId: '2000',
    });
  });

  it('잘못된 전화번호와 요청 ID는 외부 결제 전에 거부한다', async () => {
    const response = await POST(paymentRequest({
      buyerPhone: '02-1234-5678',
      productId: 'FRIENDS_10',
      requestId: 'short',
    }), { params: Promise.resolve({ publicId: 'public-1' }) });

    expect(response.status).toBe(400);
    expect(mocks.requestPayAppPayment).not.toHaveBeenCalled();
  });

  it('페이앱 요청 실패 시 READY 주문을 실패 처리하고 안전한 오류만 반환한다', async () => {
    mocks.requestPayAppPayment.mockRejectedValue(new Error('provider secret'));
    const response = await POST(paymentRequest({
      buyerPhone: '01012345678',
      productId: 'FRIENDS_10',
      requestId: 'request-1234',
    }), { params: Promise.resolve({ publicId: 'public-1' }) });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ message: '결제창을 열지 못했습니다.' });
    expect(mocks.failPendingPurchase).toHaveBeenCalledWith('order-public-random');
  });

  it('같은 요청 ID를 다른 상품에 재사용하면 외부 결제 전에 충돌로 거부한다', async () => {
    mocks.createPendingPurchase.mockRejectedValue(new PurchaseConflictError());

    const response = await POST(paymentRequest({
      buyerPhone: '01012345678',
      productId: 'FRIENDS_10',
      requestId: 'request-1234',
    }), { params: Promise.resolve({ publicId: 'public-1' }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ message: '이미 다른 상품으로 시작된 결제 요청입니다.' });
    expect(mocks.requestPayAppPayment).not.toHaveBeenCalled();
  });
});
