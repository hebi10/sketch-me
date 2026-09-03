import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  applyPayAppFeedback: vi.fn(),
  getPayAppConfig: vi.fn(),
  verifyPayAppFeedback: vi.fn(),
}));

vi.mock('@/lib/purchases/orders', () => ({ applyPayAppFeedback: mocks.applyPayAppFeedback }));
vi.mock('@/lib/payments/payapp', () => ({
  getPayAppConfig: mocks.getPayAppConfig,
  verifyPayAppFeedback: mocks.verifyPayAppFeedback,
}));

import { POST } from '@/app/api/payments/payapp/feedback/route';

function feedbackRequest(overrides: Record<string, string> = {}) {
  return new Request('https://sketch.example.com/api/payments/payapp/feedback', {
    body: new URLSearchParams({
      linkkey: 'link-key',
      linkval: 'link-value',
      mul_no: '2000',
      pay_state: '4',
      pay_type: 'CARD',
      price: '1000',
      userid: 'seller-id',
      var1: 'order-public-random',
      ...overrides,
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });
}

describe('POST /api/payments/payapp/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPayAppConfig.mockReturnValue({});
    mocks.verifyPayAppFeedback.mockReturnValue(true);
    mocks.applyPayAppFeedback.mockResolvedValue('APPLIED');
  });

  it('검증된 완료 통보를 적용한 후 페이앱 규격의 SUCCESS를 반환한다', async () => {
    const response = await POST(feedbackRequest());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('SUCCESS');
    expect(mocks.applyPayAppFeedback).toHaveBeenCalledWith({
      amount: 1000,
      orderId: 'order-public-random',
      payState: '4',
      payType: 'CARD',
      providerOrderId: '2000',
    });
  });

  it('서명 또는 주문 금액 검증 실패에는 SUCCESS를 응답하지 않는다', async () => {
    mocks.verifyPayAppFeedback.mockReturnValueOnce(false);
    const unsigned = await POST(feedbackRequest());
    expect(unsigned.status).toBe(400);
    expect(await unsigned.text()).not.toBe('SUCCESS');

    mocks.verifyPayAppFeedback.mockReturnValueOnce(true);
    mocks.applyPayAppFeedback.mockRejectedValueOnce(new Error('invalid amount'));
    const invalidAmount = await POST(feedbackRequest({ price: '1' }));
    expect(invalidAmount.status).toBe(400);
    expect(await invalidAmount.text()).not.toBe('SUCCESS');
  });
});
