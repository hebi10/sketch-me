import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { openPaymentUrl } = vi.hoisted(() => ({ openPaymentUrl: vi.fn() }));
vi.mock('@/lib/payments/browser', () => ({ openPaymentUrl }));

import { WatermarkPurchaseButton } from '@/app/m/[publicId]/share/WatermarkPurchaseButton';

describe('WatermarkPurchaseButton', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('유효한 전화번호로 주문을 만든 뒤 페이앱 결제창으로 이동한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ orderId: 'order-1', payUrl: 'https://payapp.kr/pay/2000' }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WatermarkPurchaseButton onPurchased={vi.fn()} publicId="book-1" />);
    const trigger = screen.getByRole('button', { name: '워터마크 없이 저장하기 · 1,000원' });
    expect(trigger).toBeEnabled();
    expect(screen.queryByRole('dialog', { name: '워터마크 없이 저장하기' })).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: '워터마크 없이 저장하기' })).toBeVisible();
    expect(screen.getByRole('link', { name: '서비스 이용 및 결제 안내' })).toHaveAttribute('href', '/terms#closure');
    fireEvent.change(screen.getByLabelText('결제용 휴대전화번호'), {
      target: { value: '010-1234-5678' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /결제 완료 즉시 디지털 혜택 제공/ }));
    fireEvent.click(screen.getByRole('button', { name: '1,000원 결제하기' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/manage/book-1/purchase', {
      body: expect.stringMatching(/"buyerPhone":"010-1234-5678","digitalContentConsent":true,"productId":"WATERMARK_FREE","requestId":"[^"]+"/),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }));
    expect(openPaymentUrl).toHaveBeenCalledWith('https://payapp.kr/pay/2000');
    expect(screen.queryByText('모의 결제가 완료됐습니다')).not.toBeInTheDocument();
  });

  it('결제 실패 이유와 재시도 방법을 안내한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ message: '결제 요청을 처리하지 못했어요.' }),
      ok: false,
    }));

    render(<WatermarkPurchaseButton onPurchased={vi.fn()} publicId="book-2" />);
    fireEvent.click(screen.getByRole('button', { name: '워터마크 없이 저장하기 · 1,000원' }));
    fireEvent.change(screen.getByLabelText('결제용 휴대전화번호'), {
      target: { value: '01012345678' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /결제 완료 즉시 디지털 혜택 제공/ }));
    fireEvent.click(screen.getByRole('button', { name: '1,000원 결제하기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('결제 요청을 처리하지 못했어요. 다시 시도해 주세요.');
    expect(screen.getByRole('button', { name: '1,000원 결제하기' })).toBeEnabled();
  });

  it('팝업을 닫으면 결제 입력을 숨기고 실행 버튼으로 포커스를 돌려준다', async () => {
    render(<WatermarkPurchaseButton onPurchased={vi.fn()} publicId="book-3" />);
    const trigger = screen.getByRole('button', { name: '워터마크 없이 저장하기 · 1,000원' });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: '결제창 닫기' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '워터마크 없이 저장하기' })).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });
});
