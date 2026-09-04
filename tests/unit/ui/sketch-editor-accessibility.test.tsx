import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { SketchEditor } from '@/components/sketch/SketchEditor';

function createCanvasContext() {
  return {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  };
}

describe('SketchEditor 접근 가능한 이미지 가져오기', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,blank');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('포인터를 사용하지 않아도 이미지 파일로 그림을 확정한다', async () => {
    const context = createCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,imported');
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn(), height: 1200, width: 900 }));

    render(<SketchEditor ariaLabel="친구 모습을 그리는 캔버스" />);

    fireEvent.change(screen.getByLabelText('이미지로 가져오기'), {
      target: { files: [new File(['image'], 'drawing.png', { type: 'image/png' })] },
    });

    expect(await screen.findByRole('img', { name: '그린 그림 미리보기' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('이미지를 그림으로 가져왔어요.');
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 720, 720);
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 90, 0, 540, 720);
  });

  it('펜과 지우개 상태를 aria-pressed로 전달한다', () => {
    render(<SketchEditor ariaLabel="그리기 캔버스" />);

    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    fireEvent.click(screen.getByRole('button', { name: '그리기 도구 열기' }));

    expect(screen.getByRole('button', { name: '펜' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '지우개' }));
    expect(screen.getByRole('button', { name: '지우개' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('캔버스 사용 방법을 보조기술 설명으로 연결한다', () => {
    render(<SketchEditor ariaLabel="그리기 캔버스" />);
    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));

    const canvas = screen.getByLabelText('그리기 캔버스');
    const description = document.getElementById(canvas.getAttribute('aria-describedby') ?? '');

    expect(description).toHaveTextContent('손가락이나 마우스로 그림을 그리거나 이미지로 가져오기를 사용할 수 있어요.');
  });

  it('fallback 이미지 디코딩 후 object URL을 해제한다', async () => {
    const context = createCanvasContext();
    const revokeObjectURL = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.stubGlobal('createImageBitmap', undefined);
    const NativeURL = URL;
    vi.stubGlobal('URL', class extends NativeURL {
      static createObjectURL = vi.fn(() => 'blob:imported');
      static revokeObjectURL = revokeObjectURL;
    });
    vi.stubGlobal('Image', class {
      height = 1200;
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;
      width = 900;

      set src(_value: string) {
        this.onload?.();
      }
    });

    render(<SketchEditor ariaLabel="그리기 캔버스" />);
    fireEvent.change(screen.getByLabelText('이미지로 가져오기'), {
      target: { files: [new File(['image'], 'drawing.webp', { type: 'image/webp' })] },
    });

    await screen.findByRole('img', { name: '그린 그림 미리보기' });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:imported');
  });

  it('fallback 이미지 디코딩이 실패해도 object URL을 해제한다', async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('createImageBitmap', undefined);
    const NativeURL = URL;
    vi.stubGlobal('URL', class extends NativeURL {
      static createObjectURL = vi.fn(() => 'blob:failed-import');
      static revokeObjectURL = revokeObjectURL;
    });
    vi.stubGlobal('Image', class {
      onerror: null | (() => void) = null;

      set src(_value: string) {
        this.onerror?.();
      }
    });

    render(<SketchEditor ariaLabel="그리기 캔버스" />);
    fireEvent.change(screen.getByLabelText('이미지로 가져오기'), {
      target: { files: [new File(['invalid image'], 'drawing.png', { type: 'image/png' })] },
    });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('이미지를 불러오지 못했어요. 다시 시도해 주세요.'));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:failed-import');
  });
});
