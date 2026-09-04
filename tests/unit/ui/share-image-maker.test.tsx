import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShareImageMaker } from '@/app/m/[publicId]/share/ShareImageMaker';
import type { ShareDrawingOption } from '@/lib/share/share-image';

const friendDrawing: ShareDrawingOption = {
  authorName: '해비',
  bestRank: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  id: 'friend-1',
  imageUrl: '/friend-1.webp',
  source: 'friend',
};

describe('ShareImageMaker', () => {
  const context = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    fillText: vi.fn(),
    font: '',
    globalAlpha: 1,
    lineWidth: 1,
    measureText: vi.fn(() => ({ width: 120 })),
    restore: vi.fn(),
    save: vi.fn(),
    strokeRect: vi.fn(),
    strokeStyle: '',
    textAlign: 'center',
  };

  beforeEach(() => {
    Object.values(context).forEach((value) => {
      if (typeof value === 'function' && 'mockClear' in value) value.mockClear();
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,share');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:share') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    class TestImage {
      naturalHeight = 256;
      naturalWidth = 256;
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', TestImage);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['image']) }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('한 장 모드는 1080 정사각형 PNG와 작성자 문구를 만든다', async () => {
    render(
      <ShareImageMaker
        backgroundImage="/story/background.webp"
        drawing={friendDrawing}
        drawings={[friendDrawing]}
        heading="한 장의 추억"
        mode="single"
        name="내 이름"
        publicUrl="/s/book-1"
        watermarkFree
      />,
    );

    const link = document.querySelector('a[download]') as HTMLAnchorElement | null;
    fireEvent.click(screen.getByRole('button', { name: 'PNG로 저장하기' }));

    await screen.findByText('1080 × 1080 PNG를 저장했어요.');
    const canvas = document.querySelector('canvas');
    expect(canvas).toHaveAttribute('width', '1080');
    expect(canvas).toHaveAttribute('height', '1080');
    expect(link?.download).toBe('내 이름-sketchbook-single.png');
    expect(context.fillText).toHaveBeenCalledWith('그린 사람 · 해비', 540, 946);
    expect(context.fillText).not.toHaveBeenCalledWith('나도 스케치북에 그림 남기기', expect.any(Number), expect.any(Number));
  });

  it('한 장 모드는 그림을 선택하기 전 저장할 수 없다', () => {
    render(
      <ShareImageMaker
        backgroundImage="/story/background.webp"
        drawing={null}
        drawings={[]}
        heading="한 장의 추억"
        mode="single"
        name="내 이름"
        publicUrl="/s/book-1"
        watermarkFree
      />,
    );

    expect(screen.getByRole('button', { name: 'PNG로 저장하기' })).toBeDisabled();
  });

  it('BEST 모드는 기존 1080×1440 PNG와 참여 문구를 유지한다', async () => {
    render(
      <ShareImageMaker
        backgroundImage="/story/background.webp"
        drawing={null}
        drawings={[friendDrawing]}
        heading="우리들의 베스트"
        mode="best"
        name="내 이름"
        publicUrl="/s/book-1"
        watermarkFree
      />,
    );

    const link = document.querySelector('a[download]') as HTMLAnchorElement | null;
    fireEvent.click(screen.getByRole('button', { name: 'PNG로 저장하기' }));

    await waitFor(() => expect(screen.getByText('1080 × 1440 PNG를 저장했어요.')).toBeVisible());
    const canvas = document.querySelector('canvas');
    expect(canvas).toHaveAttribute('width', '1080');
    expect(canvas).toHaveAttribute('height', '1440');
    expect(link?.download).toBe('내 이름-sketchbook-best.png');
    expect(context.fillText).toHaveBeenCalledWith('나도 스케치북에 그림 남기기', 540, 1359);
    expect(context.fillText).toHaveBeenCalledWith('http://localhost:3000/s/book-1', 540, 1418);
  });
});
