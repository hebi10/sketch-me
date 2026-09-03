import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WatermarkPurchaseButton } from '@/app/m/[publicId]/share/WatermarkPurchaseButton';

const { getPublicPaymentMode } = vi.hoisted(() => ({ getPublicPaymentMode: vi.fn() }));

vi.mock('@/lib/purchases/mode', () => ({ getPublicPaymentMode }));

describe('WatermarkPurchaseButton', () => {
  beforeEach(() => {
    getPublicPaymentMode.mockReturnValue('MOCK');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('기존 비활성 설정이 남아 있어도 워터마크 구매 버튼을 제공한다', () => {
    getPublicPaymentMode.mockReturnValue('DISABLED');

    render(<WatermarkPurchaseButton onPurchased={vi.fn()} publicId="book-disabled" />);

    expect(screen.getByRole('button', { name: '워터마크 없이 저장하기 · 990원' })).toBeEnabled();
    expect(screen.queryByRole('status', { name: '워터마크 제거 결제 준비 중' })).not.toBeInTheDocument();
  });

  it('워터마크 제거 결제를 완료하면 적용 콜백과 모의 결제 완료 팝업을 제공한다', async () => {
    const onPurchased = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ entitlements: { watermarkFree: true }, participantLimit: 20 }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WatermarkPurchaseButton onPurchased={onPurchased} publicId="book-1" />);
    fireEvent.click(screen.getByRole('button', { name: '워터마크 없이 저장하기 · 990원' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/manage/book-1/purchase', {
      body: expect.stringMatching(/"productId":"WATERMARK_FREE","requestId":"[^"]+"/),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }));
    const successDialog = await screen.findByRole('dialog', { name: '결제 완료' });
    expect(onPurchased).not.toHaveBeenCalled();
    expect(within(successDialog).getByText('모의 결제가 완료됐습니다')).toBeVisible();
    fireEvent.click(within(successDialog).getByRole('button', { name: '확인' }));
    expect(onPurchased).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: '결제 완료' })).not.toBeInTheDocument();
  });

  it('결제 실패 이유와 재시도 방법을 안내한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ message: '결제 요청을 처리하지 못했어요.' }),
      ok: false,
    }));

    render(<WatermarkPurchaseButton onPurchased={vi.fn()} publicId="book-2" />);
    fireEvent.click(screen.getByRole('button', { name: '워터마크 없이 저장하기 · 990원' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('결제 요청을 처리하지 못했어요. 다시 시도해 주세요.');
    expect(screen.getByRole('button', { name: '워터마크 없이 저장하기 · 990원' })).toBeEnabled();
  });
});
