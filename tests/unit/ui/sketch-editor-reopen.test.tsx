import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { SketchEditor } from '@/components/sketch/SketchEditor';

describe('SketchEditor 기존 그림 다시 열기', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,confirmed');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
    } as unknown as CanvasRenderingContext2D);
    vi.stubGlobal('Image', class {
      naturalHeight = 720;
      naturalWidth = 720;
      onload: ((event: Event) => unknown) | null = null;
      set src(_value: string) { this.onload?.(new Event('load')); }
    });
  });

  it('기존 그림을 불러온 뒤 선택적 다시 열기 버튼으로 편집을 이어간다', async () => {
    render(
      <SketchEditor
        ariaLabel="내 모습을 수정하는 캔버스"
        initialDrawingDataUrl="/api/manage/public-1/owner/image"
        reopenLabel="기존 그림 수정하기"
      />,
    );

    const reopenButton = await screen.findByRole('button', { name: '기존 그림 수정하기' });
    fireEvent.click(reopenButton);

    expect(screen.getByRole('dialog', { name: '전체 화면 그리기' })).toBeInTheDocument();
  });
});
