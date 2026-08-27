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

  it('참고 사진이 없어도 중앙선을 켜고 끌 수 있고 얼굴 조합 UI는 표시하지 않는다', () => {
    render(<SketchEditor ariaLabel="그리기 캔버스" />);
    openGuide();

    expect(screen.queryByText('얼굴 만들기')).not.toBeInTheDocument();
    expect(screen.getByTestId('canvas-crosshair')).toBeVisible();

    fireEvent.click(screen.getByRole('checkbox', { name: '중앙선 보기' }));
    expect(screen.queryByTestId('canvas-crosshair')).not.toBeInTheDocument();
  });

  it('참고 사진이 있으면 별도 모드 선택 없이 사진 조절 기능을 바로 표시한다', () => {
    render(
      <SketchEditor
        ariaLabel="그리기 캔버스"
        referenceImageUrl="data:image/webp;base64,reference"
      />,
    );
    openGuide();

    expect(screen.queryByRole('tab', { name: '사진 참고' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '참고 사진 숨기기' })).toBeVisible();
    expect(screen.getByRole('slider', { name: '사진 투명도' })).toBeVisible();
    expect(screen.getByRole('slider', { name: '확대' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: '중앙선 보기' })).toBeChecked();
  });
});
