import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import { SketchEditor } from '@/components/sketch/SketchEditor';

function createCanvasContext() {
  return {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    lineCap: 'round',
    lineJoin: 'round',
    lineTo: vi.fn(),
    lineWidth: 5,
    moveTo: vi.fn(),
    putImageData: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '#181818',
  };
}

function openEditor() {
  render(<SketchEditor ariaLabel="그리기 캔버스" />);
  fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
  return screen.getByLabelText('그리기 캔버스');
}

function setCanvasBounds(canvas: HTMLCanvasElement) {
  Object.defineProperty(canvas, 'setPointerCapture', { value: vi.fn() });
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    bottom: 360,
    height: 360,
    left: 0,
    right: 360,
    toJSON: () => ({}),
    top: 0,
    width: 360,
    x: 0,
    y: 0,
  });
}

function dispatchPointer(canvas: HTMLCanvasElement, type: 'down' | 'move', pointerId: number, clientX: number, clientY: number) {
  const event = new MouseEvent(`pointer${type}`, { bubbles: true, clientX, clientY });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  fireEvent(canvas, event);
}

describe('SketchEditor 두 손가락 확대', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('처음 연 그림판에서만 확대 방법을 잠시 안내한다', () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(createCanvasContext() as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,blank');

    openEditor();

    expect(screen.getByText('두 손가락으로 확대할 수 있어요')).toBeVisible();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText('두 손가락으로 확대할 수 있어요')).not.toBeInTheDocument();
  });

  it('두 손가락을 벌리고 이동하면 선을 남기지 않고 확대율과 시점을 표시한다', () => {
    const drawingContext = createCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(drawingContext as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,blank');
    const canvas = openEditor() as HTMLCanvasElement;
    setCanvasBounds(canvas);

    dispatchPointer(canvas, 'down', 1, 100, 180);
    dispatchPointer(canvas, 'down', 2, 200, 180);
    dispatchPointer(canvas, 'move', 1, 190, 180);
    dispatchPointer(canvas, 'move', 2, 390, 180);

    expect(drawingContext.putImageData).toHaveBeenCalledWith(expect.anything(), 0, 0);
    expect(screen.getByRole('button', { name: '그림 기록 한 단계 이전' })).toBeDisabled();
    expect(screen.getByLabelText('캔버스 확대 상태 200%')).toHaveTextContent(/^200%$/);
    expect(document.querySelector('.drawing-surface')).toHaveStyle('transform: translate(170px, 0px) scale(2)');
  });
});
