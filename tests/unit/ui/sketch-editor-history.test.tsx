import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { SketchEditor } from '@/components/sketch/SketchEditor';

function createCanvasContext() {
  return {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    lineCap: 'round',
    lineJoin: 'round',
    lineTo: vi.fn(),
    lineWidth: 5,
    moveTo: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '#181818',
  };
}

function prepareCanvas() {
  const canvas = screen.getByLabelText('그리기 캔버스');
  Object.defineProperty(canvas, 'setPointerCapture', { value: vi.fn() });
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    bottom: 100,
    height: 100,
    left: 0,
    right: 100,
    toJSON: () => ({}),
    top: 0,
    width: 100,
    x: 0,
    y: 0,
  });
  return canvas;
}

describe('SketchEditor 그리기 기록', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('캔버스 아래의 이전 버튼으로 그림 기록을 한 단계 되돌린다', () => {
    const context = createCanvasContext();
    const restoredSources: string[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValueOnce('blank')
      .mockReturnValueOnce('stroke-1');

    class TestImage {
      onload: null | (() => void) = null;
      private value = '';

      get src() {
        return this.value;
      }

      set src(next: string) {
        this.value = next;
        restoredSources.push(next);
        this.onload?.();
      }
    }
    vi.stubGlobal('Image', TestImage);

    render(<SketchEditor ariaLabel="그리기 캔버스" />);
    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));

    const undo = screen.getByRole('button', { name: '그림 기록 한 단계 이전' });
    expect(undo).toBeDisabled();

    const canvas = prepareCanvas();
    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });

    expect(undo).toBeEnabled();
    fireEvent.click(undo);

    expect(restoredSources.at(-1)).toBe('blank');
    expect(screen.getByRole('dialog', { name: '전체 화면 그리기' })).toBeVisible();
  });

  it('손을 떼어 완료한 선을 한 단계씩 되돌리고 다시 실행한다', () => {
    const context = createCanvasContext();
    const restoredSources: string[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValueOnce('blank')
      .mockReturnValueOnce('stroke-1')
      .mockReturnValueOnce('stroke-2');

    class TestImage {
      onload: null | (() => void) = null;
      private value = '';

      get src() {
        return this.value;
      }

      set src(next: string) {
        this.value = next;
        restoredSources.push(next);
        this.onload?.();
      }
    }
    vi.stubGlobal('Image', TestImage);

    render(<SketchEditor ariaLabel="그리기 캔버스" />);
    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    fireEvent.click(screen.getByRole('button', { name: '그리기 도구 열기' }));
    const canvas = prepareCanvas();

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40, pointerId: 2 });
    fireEvent.pointerUp(canvas, { pointerId: 2 });

    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(restoredSources.at(-1)).toBe('stroke-1');
    expect(screen.getByRole('button', { name: '다시 실행' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '다시 실행' }));
    expect(restoredSources.at(-1)).toBe('stroke-2');
  });

  it('되돌리기와 다시 실행을 설명 가능한 이미지 아이콘으로 표시한다', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('blank');
    render(<SketchEditor ariaLabel="그리기 캔버스" />);
    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    fireEvent.click(screen.getByRole('button', { name: '그리기 도구 열기' }));

    const undo = screen.getByRole('button', { name: '되돌리기' });
    const redo = screen.getByRole('button', { name: '다시 실행' });

    expect(undo.textContent).toBe('');
    expect(undo.querySelector('img')).toHaveAttribute('src', expect.stringContaining('drawing-undo.webp'));
    expect(redo.textContent).toBe('');
    expect(redo.querySelector('img')).toHaveAttribute('src', expect.stringContaining('drawing-redo.webp'));
  });
});
