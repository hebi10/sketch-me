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

function openDrawingTools() {
  fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
  fireEvent.click(screen.getByRole('button', { name: '그리기 도구 열기' }));
}

describe('SketchEditor 투명도 조절', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
  });

  it('펜 투명도 드래그 조절을 굵기 조절 위에 표시한다', () => {
    render(<SketchEditor ariaLabel="그리기 캔버스" />);
    openDrawingTools();

    const opacity = screen.getByRole('slider', { name: /펜 투명도/ });
    const thickness = screen.getByRole('slider', { name: /굵기/ });

    expect(opacity).toHaveValue('100');
    expect(opacity.compareDocumentPosition(thickness) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.change(opacity, { target: { value: '40' } });
    expect(opacity).toHaveValue('40');
    expect(screen.getByText('40%')).toBeVisible();
  });

  it('펜에는 선택한 투명도를 적용하고 지우개는 불투명하게 처리한다', () => {
    const context = createCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    render(<SketchEditor ariaLabel="그리기 캔버스" />);
    openDrawingTools();
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

    fireEvent.change(screen.getByRole('slider', { name: /펜 투명도/ }), { target: { value: '40' } });
    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
    expect(context.globalAlpha).toBe(0.4);

    fireEvent.click(screen.getByRole('button', { name: '지우개' }));
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30, pointerId: 2 });
    expect(context.globalAlpha).toBe(1);
  });

  it('참고사진 투명도를 드래그 값에 맞춰 적용한다', () => {
    render(<SketchEditor ariaLabel="그리기 캔버스" referenceImageUrl="/reference.webp" />);
    openDrawingTools();

    fireEvent.click(screen.getByRole('button', { name: '가이드' }));
    fireEvent.click(screen.getByRole('tab', { name: '사진 참고' }));
    const opacity = screen.getByRole('slider', { name: /사진 투명도/ });
    fireEvent.change(opacity, { target: { value: '35' } });

    expect(opacity).toHaveValue('35');
    expect(screen.getByText('35%')).toBeVisible();
    expect(screen.getByAltText('그림 참고 사진').parentElement).toHaveStyle({ opacity: '0.35' });
  });

  it('참고사진 확대를 투명도와 같은 범위 컨트롤로 표시한다', () => {
    render(<SketchEditor ariaLabel="그리기 캔버스" referenceImageUrl="/reference.webp" />);
    openDrawingTools();

    fireEvent.click(screen.getByRole('button', { name: '가이드' }));
    fireEvent.click(screen.getByRole('tab', { name: '사진 참고' }));
    const scale = screen.getByRole('slider', { name: '확대' });
    fireEvent.change(scale, { target: { value: '1.5' } });

    expect(scale).toHaveValue('1.5');
    expect(screen.getByText('150%')).toBeVisible();
  });

  it('참고사진을 숨겼다가 기존 설정 그대로 다시 표시한다', () => {
    render(<SketchEditor ariaLabel="그리기 캔버스" referenceImageUrl="/reference.webp" />);
    openDrawingTools();

    fireEvent.click(screen.getByRole('button', { name: '가이드' }));
    fireEvent.click(screen.getByRole('tab', { name: '사진 참고' }));
    fireEvent.change(screen.getByRole('slider', { name: /사진 투명도/ }), { target: { value: '35' } });

    const referenceLayer = screen.getByAltText('그림 참고 사진').parentElement;
    const hideButton = screen.getByRole('button', { name: '참고 사진 숨기기' });
    expect(hideButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(hideButton);
    expect(referenceLayer).not.toBeVisible();
    expect(screen.getByRole('button', { name: '참고 사진 보기' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: '참고 사진 보기' }));
    expect(referenceLayer).toBeVisible();
    expect(referenceLayer).toHaveStyle({ opacity: '0.35' });
  });
});
