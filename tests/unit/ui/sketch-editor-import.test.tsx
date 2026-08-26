import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { SketchEditor } from '@/components/sketch/SketchEditor';

function createCanvasContext() {
  return {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
  };
}

describe('SketchEditor 완성 그림 불러오기', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,confirmed');
  });

  it('PNG를 정사각 캔버스에 contain 방식으로 불러오고 확인 결과를 알린다', async () => {
    const context = createCanvasContext();
    const onDrawingChange = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.stubGlobal('FileReader', class {
      result = 'data:image/png;base64,source';
      onerror: ((event: Event) => unknown) | null = null;
      onload: ((event: Event) => unknown) | null = null;
      readAsDataURL() { this.onload?.(new ProgressEvent('load')); }
    });
    vi.stubGlobal('Image', class {
      height = 720;
      naturalHeight = 720;
      naturalWidth = 1440;
      onerror: ((event: Event) => unknown) | null = null;
      onload: ((event: Event) => unknown) | null = null;
      width = 1440;
      set src(_value: string) { this.onload?.(new Event('load')); }
    });
    render(<SketchEditor ariaLabel="그리기 캔버스" onDrawingChange={onDrawingChange} />);

    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    const file = new File(['drawing'], 'drawing.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('완성된 그림 불러오기'), { target: { files: [file] } });

    await waitFor(() => expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 180, 720, 360));
    expect(screen.getByRole('status')).toHaveTextContent('그림을 불러왔어요. 확인을 누르면 제출할 수 있어요.');
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(onDrawingChange).toHaveBeenCalledWith('data:image/webp;base64,confirmed');
  });

  it.each([
    [new File(['drawing'], 'drawing.gif', { type: 'image/gif' }), 'PNG, JPG, WEBP 그림만 불러올 수 있어요.'],
    [{ name: 'drawing.png', size: 2 * 1024 * 1024 + 1, type: 'image/png' } as File, '그림 파일은 2MB 이하로 선택해 주세요.'],
  ])('지원하지 않는 파일은 인라인 오류로 안내한다', (file, message) => {
    render(<SketchEditor ariaLabel="그리기 캔버스" />);

    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    fireEvent.change(screen.getByLabelText('완성된 그림 불러오기'), { target: { files: [file] } });

    expect(screen.getByRole('alert')).toHaveTextContent(message);
  });
});
