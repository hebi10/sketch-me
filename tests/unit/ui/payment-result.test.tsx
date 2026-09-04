import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PaymentResult } from '@/app/m/[publicId]/payment/result/PaymentResult';

describe('PaymentResult', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('서버 주문이 완료된 경우에만 완료 결과를 표시한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({
        amount: 1000,
        cancelledAt: null,
        createdAt: '2026-09-04T01:00:00.000Z',
        orderId: 'order-1',
        paidAt: '2026-09-04T01:01:00.000Z',
        paymentStatus: 'SUCCEEDED',
        productType: 'WATERMARK_FREE',
        providerPayType: 'CARD',
      }),
      ok: true,
    }));

    render(<PaymentResult orderId="order-1" publicId="public-1" />);

    expect(await screen.findByRole('heading', { name: '결제가 완료됐습니다' })).toBeVisible();
    expect(screen.getByText('워터마크 제거가 적용됐어요.')).toBeVisible();
    expect(screen.getByText('order-1')).toBeVisible();
    expect(screen.getByText('1,000원')).toBeVisible();
    expect(screen.getByText('신용카드')).toBeVisible();
    expect(screen.getByText(/사업자등록번호 432-13-02831/)).toBeVisible();
    expect(screen.getByRole('link', { name: '청약철회·환불 신청' }))
      .toHaveAttribute('href', expect.stringContaining('mailto:asdlkj0104@gmail.com'));
    expect(screen.getByRole('link', { name: '서비스 이용 및 결제 안내' }))
      .toHaveAttribute('href', '/terms#withdrawal');
  });

  it('전자 영수증을 브라우저 인쇄로 저장할 수 있다', async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({
        amount: 4490,
        cancelledAt: null,
        createdAt: '2026-09-04T01:00:00.000Z',
        orderId: 'order-2',
        paidAt: '2026-09-04T01:01:00.000Z',
        paymentStatus: 'SUCCEEDED',
        productType: 'FRIENDS_50',
        providerPayType: 'CARD',
      }),
      ok: true,
    }));

    render(<PaymentResult orderId="order-2" publicId="public-1" />);
    fireEvent.click(await screen.findByRole('button', { name: '영수증 인쇄' }));

    expect(print).toHaveBeenCalledTimes(1);
  });

  it('확인 중에는 완료로 표시하지 않는다', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    render(<PaymentResult orderId="order-1" publicId="public-1" />);

    expect(screen.getByRole('heading', { name: '결제 결과를 확인하고 있습니다' })).toBeVisible();
    expect(screen.queryByText('결제가 완료됐습니다')).not.toBeInTheDocument();
  });

  it('동의 기록이 없는 결제는 완료로 표시하지 않고 문의를 안내한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({
        amount: 1000,
        paymentStatus: 'REVIEW_REQUIRED',
        productType: 'WATERMARK_FREE',
      }),
      ok: true,
    }));

    render(<PaymentResult orderId="order-1" publicId="public-1" />);

    expect(await screen.findByRole('heading', { name: '결제 확인이 필요합니다' })).toBeVisible();
    expect(screen.getByText(/혜택은 적용되지 않았습니다/)).toBeVisible();
  });
});
