import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

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
    stroke: vi.fn(),
    strokeStyle: '#181818',
  };
}

describe('SketchEditor 그리기 돋보기', () => {
  it('그리는 동안 손가락 왼쪽의 현재 지점을 확대하고 손을 떼면 숨긴다', () => {
    const drawingContext = createCanvasContext();
    const loupeContext = createCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
      return (this.dataset.loupe === 'true' ? loupeContext : drawingContext) as unknown as CanvasRenderingContext2D;
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,blank');

    render(<SketchEditor ariaLabel="그리기 캔버스" />);
    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    fireEvent.click(screen.getByRole('button', { name: '그리기 도구 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '파랑 색상' }));
    fireEvent.change(screen.getByLabelText('펜 투명도'), { target: { value: '55' } });
    fireEvent.change(screen.getByLabelText('굵기'), { target: { value: '12' } });

    const canvas = screen.getByLabelText('그리기 캔버스');
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

    const loupe = screen.getByTestId('drawing-loupe');
    expect(loupe).toHaveAttribute('data-active', 'false');
    expect(loupe.querySelector('.drawing-loupe-tip')).toBeInTheDocument();

    fireEvent(canvas, new MouseEvent('pointerdown', { bubbles: true, clientX: 180, clientY: 180 }));

    expect(loupe).toHaveAttribute('data-active', 'true');
    expect(loupe).toHaveAttribute('data-placement', 'above');
    expect(Number.parseFloat(loupe.style.left)).toBeLessThan(50);
    expect(loupe).toHaveStyle({
      '--loupe-brush-color': '#506f8f',
      '--loupe-brush-opacity': '55%',
      '--loupe-brush-size': '12px',
    });
    expect(loupeContext.drawImage).toHaveBeenCalledWith(
      canvas,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      0,
      0,
      104,
      104,
    );

    fireEvent(canvas, new MouseEvent('pointermove', { bubbles: true, clientX: 180, clientY: 20 }));
    expect(loupe).toHaveAttribute('data-placement', 'below');

    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true }));
    expect(loupe).toHaveAttribute('data-active', 'false');
  });

  it('가이드에서 돋보기를 끄면 그리는 동안에도 표시하지 않는다', () => {
    const drawingContext = createCanvasContext();
    const loupeContext = createCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
      return (this.dataset.loupe === 'true' ? loupeContext : drawingContext) as unknown as CanvasRenderingContext2D;
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,blank');

    render(<SketchEditor ariaLabel="그리기 캔버스" />);
    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    fireEvent.click(screen.getByRole('button', { name: '그리기 도구 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '가이드' }));

    const loupeToggle = screen.getByRole('checkbox', { name: '돋보기 보기' });
    expect(loupeToggle).toBeChecked();
    fireEvent.click(loupeToggle);
    fireEvent.click(screen.getByRole('button', { name: '그리기' }));

    const canvas = screen.getByLabelText('그리기 캔버스');
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

    fireEvent(canvas, new MouseEvent('pointerdown', { bubbles: true, clientX: 180, clientY: 180 }));

    expect(screen.getByTestId('drawing-loupe')).toHaveAttribute('data-active', 'false');
    expect(loupeContext.drawImage).not.toHaveBeenCalled();
  });
});
