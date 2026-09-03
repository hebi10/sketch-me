import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PaymentResult } from '@/app/m/[publicId]/payment/result/PaymentResult';

describe('PaymentResult', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('서버 주문이 완료된 경우에만 완료 결과를 표시한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({
        amount: 1000,
        paymentStatus: 'SUCCEEDED',
        productType: 'WATERMARK_FREE',
      }),
      ok: true,
    }));

    render(<PaymentResult orderId="order-1" publicId="public-1" />);

    expect(await screen.findByRole('heading', { name: '결제가 완료됐습니다' })).toBeVisible();
    expect(screen.getByText('워터마크 제거가 적용됐어요.')).toBeVisible();
  });

  it('확인 중에는 완료로 표시하지 않는다', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    render(<PaymentResult orderId="order-1" publicId="public-1" />);

    expect(screen.getByRole('heading', { name: '결제 결과를 확인하고 있습니다' })).toBeVisible();
    expect(screen.queryByText('결제가 완료됐습니다')).not.toBeInTheDocument();
  });
});
