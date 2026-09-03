import { vi } from 'vitest';

const { findPurchaseByOrderId } = vi.hoisted(() => ({ findPurchaseByOrderId: vi.fn() }));
vi.mock('@/lib/purchases/orders', () => ({ findPurchaseByOrderId }));

import { GET, POST } from '@/app/api/payments/payapp/return/route';

describe('/api/payments/payapp/return', () => {
  beforeEach(() => {
    findPurchaseByOrderId.mockResolvedValue({ sketchbookPublicId: 'public-1' });
  });

  it.each([GET, POST])('결제를 확정하지 않고 서버 결과 화면으로 303 복귀한다', async (handler) => {
    const response = await handler(new Request(
      'https://sketch.example.com/api/payments/payapp/return?orderId=order-public-random',
      { method: handler === POST ? 'POST' : 'GET' },
    ));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'https://sketch.example.com/m/public-1/payment/result?orderId=order-public-random',
    );
  });
});
