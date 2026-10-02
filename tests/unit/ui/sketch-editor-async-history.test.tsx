import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { SketchEditor } from '@/components/sketch/SketchEditor';

describe('SketchEditor 비동기 기록 복원', () => {
  let pendingImages: Array<{ onload: (() => void) | null; src: string }>;
  let scenes: WeakMap<HTMLCanvasElement, string>;
  let strokeCount: number;

  beforeEach(() => {
    pendingImages = [];
    scenes = new WeakMap();
    strokeCount = 0;
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      private source = '';
      get src() { return this.source; }
      set src(value: string) { this.source = value; pendingImages.push(this); }
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (this: HTMLCanvasElement, type = 'image/png') {
      return `data:${type};base64,${scenes.get(this) ?? 'blank'}`;
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      return {
        beginPath() {}, moveTo() {}, lineTo() {}, fillRect() {},
        stroke: () => { scenes.set(this, `stroke-${++strokeCount}`); },
        clearRect: () => { scenes.set(this, 'blank'); },
        drawImage: (image: HTMLCanvasElement | { src: string }) => {
          scenes.set(this, image instanceof HTMLCanvasElement ? scenes.get(image) ?? 'blank' : image.src.split(',')[1]);
        },
        getImageData: () => {
          const scene = scenes.get(this) ?? 'blank';
          return { data: new Uint8ClampedArray([0, 0, 0, scene === 'blank' ? 0 : 255]), scene };
        },
        putImageData: (pixels: { scene: string }) => { scenes.set(this, pixels.scene); },
      } as unknown as CanvasRenderingContext2D;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function drawTwoStrokes() {
    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    const canvas = screen.getByLabelText('그리기 캔버스');
    Object.defineProperty(canvas, 'setPointerCapture', { value: vi.fn() });
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 100, left: 0, top: 0 } as DOMRect);
    for (let index = 0; index < 2; index += 1) {
      fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
      fireEvent.pointerUp(canvas, { pointerId: 1 });
    }
    return canvas as HTMLCanvasElement;
  }

  function finishLoading(index: number) {
    act(() => pendingImages[index].onload?.());
  }

  it('되돌리기를 기다리다 나가면 늦은 복원이 폐기한 그림과 초안을 되살리지 않는다', () => {
    const onDrawingChange = vi.fn();
    render(<SketchEditor ariaLabel="그리기 캔버스" onDrawingChange={onDrawingChange} />);
    const canvas = drawTwoStrokes();
    fireEvent.click(screen.getByRole('button', { name: '그림 기록 한 단계 이전' }));
    fireEvent.click(screen.getByRole('button', { name: '그리기 나가기' }));
    finishLoading(0);

    expect(canvas.toDataURL()).toBe('data:image/png;base64,blank');
    expect(onDrawingChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('다시 편집을 취소하면 시작 그림을 즉시 복원하고 늦은 되돌리기를 무시한다', () => {
    const onDrawingChange = vi.fn();
    render(<SketchEditor ariaLabel="그리기 캔버스" onDrawingChange={onDrawingChange} reopenLabel="그림 수정하기" />);
    const canvas = drawTwoStrokes();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    fireEvent.click(screen.getByRole('button', { name: '그림 수정하기' }));
    fireEvent.click(screen.getByRole('button', { name: '그림 기록 한 단계 이전' }));
    fireEvent.click(screen.getByRole('button', { name: '그리기 나가기' }));

    expect(canvas.toDataURL()).toBe('data:image/png;base64,stroke-2');
    finishLoading(0);
    expect(canvas.toDataURL()).toBe('data:image/png;base64,stroke-2');
    expect(onDrawingChange).toHaveBeenLastCalledWith('data:image/webp;base64,stroke-2');
  });

  it('연속 되돌리기와 다시 실행은 마지막 요청 순서대로 그림을 복원한다', () => {
    const onDrawingChange = vi.fn();
    render(<SketchEditor ariaLabel="그리기 캔버스" onDrawingChange={onDrawingChange} />);
    const canvas = drawTwoStrokes();
    fireEvent.click(screen.getByRole('button', { name: '그리기 도구 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    fireEvent.click(screen.getByRole('button', { name: '다시 실행' }));

    expect(pendingImages.map((image) => image.src)).toEqual([
      'data:image/png;base64,stroke-1', 'data:image/png;base64,blank', 'data:image/png;base64,stroke-1',
    ]);
    finishLoading(2);
    finishLoading(0);
    finishLoading(1);
    expect(canvas.toDataURL()).toBe('data:image/png;base64,stroke-1');
    expect(onDrawingChange).toHaveBeenLastCalledWith('data:image/png;base64,stroke-1');
  });

  it('복원 중인 그림을 기다린 뒤 확인하고 이전 요청의 늦은 결과는 무시한다', () => {
    const onDrawingChange = vi.fn();
    render(<SketchEditor ariaLabel="그리기 캔버스" onDrawingChange={onDrawingChange} />);
    const canvas = drawTwoStrokes();
    fireEvent.click(screen.getByRole('button', { name: '그림 기록 한 단계 이전' }));
    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '그림 기록 한 단계 이전' }));
    finishLoading(0);
    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled();
    finishLoading(1);
    expect(screen.getByRole('button', { name: '확인' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '그리기 도구 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '다시 실행' }));
    finishLoading(2);
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    finishLoading(0);

    expect(canvas.toDataURL()).toBe('data:image/png;base64,stroke-1');
    expect(onDrawingChange).toHaveBeenLastCalledWith('data:image/webp;base64,stroke-1');
  });

  it('화면이 해제되면 남은 복원 요청을 부모에게 전달하지 않는다', () => {
    const onDrawingChange = vi.fn();
    const view = render(<SketchEditor ariaLabel="그리기 캔버스" onDrawingChange={onDrawingChange} />);
    drawTwoStrokes();
    fireEvent.click(screen.getByRole('button', { name: '그림 기록 한 단계 이전' }));
    view.unmount();
    onDrawingChange.mockClear();
    finishLoading(0);

    expect(onDrawingChange).not.toHaveBeenCalled();
  });
});
