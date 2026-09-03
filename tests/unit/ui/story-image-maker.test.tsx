import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StoryImageMaker } from '@/app/m/[publicId]/share/StoryImageMaker';

describe('StoryImageMaker', () => {
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
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,story');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:story') });
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

  it('기본 저장 이미지에 생성된 스캐치북 워터마크를 합성한다', async () => {
    render(<StoryImageMaker backgroundImage="/story/background.webp" drawings={[]} heading="친구들이 그린 내 모습" name="내 이름" publicUrl="/s/book-1" watermarkFree={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'PNG로 저장하기' }));

    await screen.findByText('1080 × 1440 PNG를 저장했어요.');
    expect(fetch).toHaveBeenCalledWith('/brand/sketchbook-watermark.webp', { credentials: 'same-origin' });
    expect(context.fillText).toHaveBeenCalledWith('스캐치북', expect.any(Number), expect.any(Number));
  });

  it('워터마크 제거가 적용되면 저장 이미지에 워터마크를 넣지 않는다', async () => {
    render(<StoryImageMaker backgroundImage="/story/background.webp" drawings={[]} heading="친구들이 그린 내 모습" name="내 이름" publicUrl="/s/book-1" watermarkFree />);
    fireEvent.click(screen.getByRole('button', { name: 'PNG로 저장하기' }));

    await waitFor(() => expect(screen.getByText('1080 × 1440 PNG를 저장했어요.')).toBeVisible());
    expect(fetch).not.toHaveBeenCalledWith('/brand/sketchbook-watermark.webp', expect.anything());
    expect(context.fillText).not.toHaveBeenCalledWith('스캐치북', expect.any(Number), expect.any(Number));
  });

  it('사용자가 저장한 제목을 PNG에 합성한다', async () => {
    render(<StoryImageMaker backgroundImage="/story/background.webp" drawings={[]} heading="우리들의 소중한 추억" name="내 이름" publicUrl="/s/book-1" watermarkFree />);
    fireEvent.click(screen.getByRole('button', { name: 'PNG로 저장하기' }));

    await screen.findByText('1080 × 1440 PNG를 저장했어요.');
    expect(context.fillText).toHaveBeenCalledWith('우리들의 소중한 추억', 540, 94);
  });
});
