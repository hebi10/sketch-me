import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WatermarkPurchaseButton } from '@/app/m/[publicId]/share/WatermarkPurchaseButton';

describe('WatermarkPurchaseButton', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('워터마크 제거 상품을 모의 결제하고 적용 콜백을 실행한다', async () => {
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
    expect(onPurchased).toHaveBeenCalledOnce();
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
