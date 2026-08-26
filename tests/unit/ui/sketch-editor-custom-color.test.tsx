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

describe('SketchEditor 사용자 지정 색상', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
  });

  it('선택한 사용자 지정 색상을 다음 펜 선에 적용한다', () => {
    const context = createCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    render(<SketchEditor ariaLabel="그리기 캔버스" />);

    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    fireEvent.click(screen.getByRole('button', { name: '그리기 도구 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '지우개' }));
    fireEvent.change(screen.getByLabelText('사용자 지정 색상 선택'), { target: { value: '#e83e8c' } });

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

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20, pointerId: 1 });

    expect(context.globalCompositeOperation).toBe('source-over');
    expect(context.strokeStyle).toBe('#e83e8c');
    expect(screen.getByLabelText('사용자 지정 색상 #e83e8c')).toHaveValue('#e83e8c');
  });
});
