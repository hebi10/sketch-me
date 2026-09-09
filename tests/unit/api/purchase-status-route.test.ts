import { GET } from '@/app/api/manage/[publicId]/purchases/[orderId]/route';

describe('GET /api/manage/:publicId/purchases/:orderId', () => {
  it('무료 운영 중에는 결제 주문을 조회하지 않는다', async () => {
    const response = await GET();

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({ message: '결제 기능을 운영하지 않습니다.' });
  });

  /* 결제 시스템 비활성화: 기존 결제 주문 조회 응답 검증을 보존합니다.
  it('관리 권한이 있는 주문의 공개 가능한 상태만 반환한다', async () => {
    mocks.getManagedSketchbook.mockResolvedValue({ id: 'book-1' });
    mocks.getManagedPurchase.mockResolvedValue({
      amount: 1000,
      buyerPhoneLast4: '5678',
      cancelledAt: null,
      createdAt: new Date('2026-09-04T01:00:00.000Z'),
      orderId: 'order-public-random',
      paidAt: new Date('2026-09-04T01:01:00.000Z'),
      paymentStatus: 'SUCCEEDED',
      productType: 'WATERMARK_FREE',
      providerOrderId: 'secret-provider-order',
      providerPayType: 'CARD',
      sketchbookId: 'book-1',
    });
    const response = await GET(new Request('https://sketch.example.com'), {
      params: Promise.resolve({ orderId: 'order-public-random', publicId: 'public-1' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      amount: 1000,
      cancelledAt: null,
      createdAt: '2026-09-04T01:00:00.000Z',
      orderId: 'order-public-random',
      paidAt: '2026-09-04T01:01:00.000Z',
      paymentStatus: 'SUCCEEDED',
      productType: 'WATERMARK_FREE',
      providerPayType: 'CARD',
    });
    expect(JSON.stringify(body)).not.toContain('5678');
    expect(JSON.stringify(body)).not.toContain('secret-provider-order');
  });
  */
});
