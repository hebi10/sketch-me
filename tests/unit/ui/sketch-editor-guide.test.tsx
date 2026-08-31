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

function openGuide() {
  fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
  fireEvent.click(screen.getByRole('button', { name: '그리기 도구 열기' }));
  fireEvent.click(screen.getByRole('button', { name: '가이드' }));
}

describe('SketchEditor 가이드', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,blank');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      createCanvasContext() as unknown as CanvasRenderingContext2D,
    );
  });

  it('가이드에서는 중앙선만 켜고 끌 수 있다', () => {
    render(<SketchEditor ariaLabel="그리기 캔버스" />);
    openGuide();

    expect(screen.queryByText('얼굴 만들기')).not.toBeInTheDocument();
    expect(screen.getByText('중앙선을 켜고 얼굴 비율을 확인해 보세요.')).toBeVisible();
    expect(screen.queryByText(/참고 사진/)).not.toBeInTheDocument();
    expect(screen.getByTestId('canvas-crosshair')).toBeVisible();

    fireEvent.click(screen.getByRole('checkbox', { name: '중앙선 보기' }));
    expect(screen.queryByTestId('canvas-crosshair')).not.toBeInTheDocument();
  });

});
