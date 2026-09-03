import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getManagedPurchase: vi.fn(), getManagedSketchbook: vi.fn() }));
vi.mock('@/lib/purchases/orders', () => ({ getManagedPurchase: mocks.getManagedPurchase }));
vi.mock('@/lib/sketchbooks/management', () => ({ getManagedSketchbook: mocks.getManagedSketchbook }));

import { GET } from '@/app/api/manage/[publicId]/purchases/[orderId]/route';

describe('GET /api/manage/:publicId/purchases/:orderId', () => {
  it('관리 권한이 있는 주문의 공개 가능한 상태만 반환한다', async () => {
    mocks.getManagedSketchbook.mockResolvedValue({ id: 'book-1' });
    mocks.getManagedPurchase.mockResolvedValue({
      amount: 1000,
      buyerPhoneLast4: '5678',
      paymentStatus: 'SUCCEEDED',
      productType: 'WATERMARK_FREE',
      providerOrderId: 'secret-provider-order',
      sketchbookId: 'book-1',
    });
    const response = await GET(new Request('https://sketch.example.com'), {
      params: Promise.resolve({ orderId: 'order-public-random', publicId: 'public-1' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      amount: 1000,
      paymentStatus: 'SUCCEEDED',
      productType: 'WATERMARK_FREE',
    });
    expect(JSON.stringify(body)).not.toContain('5678');
    expect(JSON.stringify(body)).not.toContain('secret-provider-order');
  });
});
