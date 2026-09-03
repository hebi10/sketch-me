import { vi } from 'vitest';

const { addMockPurchase, getManagedSketchbook, getServerPaymentMode } = vi.hoisted(() => ({
  addMockPurchase: vi.fn(),
  getManagedSketchbook: vi.fn(),
  getServerPaymentMode: vi.fn(),
}));

vi.mock('@/lib/sketchbooks/management', () => ({ getManagedSketchbook }));
vi.mock('@/lib/sketchbooks/repository', () => ({ addMockPurchase }));
vi.mock('@/lib/purchases/mode', () => ({ getServerPaymentMode }));

import { POST } from '@/app/api/manage/[publicId]/purchase/route';

const sketchbook = {
  entitlements: { watermarkFree: false },
  id: 'book-1',
  participantLimit: 20,
};

describe('POST /api/manage/:publicId/purchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerPaymentMode.mockReturnValue('MOCK');
    getManagedSketchbook.mockResolvedValue(sketchbook);
    addMockPurchase.mockResolvedValue({
      entitlements: { watermarkFree: false },
      participantLimit: 70,
    });
  });

  it('기존 비활성 설정이 남아 있어도 심사용 결제를 처리한다', async () => {
    getServerPaymentMode.mockReturnValue('DISABLED');
    const request = new Request('http://localhost/api/manage/public-1/purchase', {
      body: JSON.stringify({ productId: 'FRIENDS_10', requestId: 'purchase-attempt-1234' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ publicId: 'public-1' }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      entitlements: { watermarkFree: false },
      participantLimit: 70,
    });
    expect(getManagedSketchbook).toHaveBeenCalledWith('public-1');
    expect(addMockPurchase).toHaveBeenCalledOnce();
  });

  it('허용된 상품을 서버 가격으로 결제하고 갱신된 한도를 반환한다', async () => {
    const request = new Request('http://localhost/api/manage/public-1/purchase', {
      body: JSON.stringify({ productId: 'FRIENDS_50', requestId: 'purchase-attempt-1234' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ publicId: 'public-1' }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      entitlements: { watermarkFree: false },
      participantLimit: 70,
    });
    expect(addMockPurchase).toHaveBeenCalledWith(sketchbook, expect.objectContaining({
      additionalLimit: 50,
      amount: 4490,
      kind: 'capacity',
      productId: 'FRIENDS_50',
    }), 'purchase-attempt-1234');
  });

  it('워터마크 제거 상품은 서버의 990원 권한 상품으로만 처리한다', async () => {
    addMockPurchase.mockResolvedValueOnce({
      entitlements: { watermarkFree: true },
      participantLimit: 20,
    });
    const request = new Request('http://localhost/api/manage/public-1/purchase', {
      body: JSON.stringify({
        amount: 1,
        productId: 'WATERMARK_FREE',
        requestId: 'watermark-attempt-1234',
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ publicId: 'public-1' }) });

    await expect(response.json()).resolves.toEqual({
      entitlements: { watermarkFree: true },
      participantLimit: 20,
    });
    expect(addMockPurchase).toHaveBeenCalledWith(sketchbook, expect.objectContaining({
      additionalLimit: 0,
      amount: 990,
      kind: 'watermark',
      productId: 'WATERMARK_FREE',
    }), 'watermark-attempt-1234');
  });

  it('등록되지 않은 상품은 결제하지 않는다', async () => {
    const request = new Request('http://localhost/api/manage/public-1/purchase', {
      body: JSON.stringify({ productId: 'FRIENDS_999' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ publicId: 'public-1' }) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: '선택한 상품을 확인해 주세요.' });
    expect(addMockPurchase).not.toHaveBeenCalled();
  });

  it('결제 시도 ID가 없으면 한도를 변경하지 않는다', async () => {
    const request = new Request('http://localhost/api/manage/public-1/purchase', {
      body: JSON.stringify({ productId: 'FRIENDS_10' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ publicId: 'public-1' }) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: '결제 요청을 다시 시작해 주세요.' });
    expect(addMockPurchase).not.toHaveBeenCalled();
  });
});
