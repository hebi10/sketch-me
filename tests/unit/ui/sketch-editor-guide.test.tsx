import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { SketchEditor } from '@/components/sketch/SketchEditor';

function createCanvasContext(alpha = 0) {
  return {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, alpha]) })),
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

function openTools() {
  fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
  fireEvent.click(screen.getByRole('button', { name: '그리기 도구 열기' }));
}

function openFaceBuilder() {
  fireEvent.click(screen.getByRole('button', { name: '가이드' }));
  fireEvent.click(screen.getByRole('tab', { name: '얼굴 만들기' }));
}

describe('SketchEditor 가이드', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,result');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      createCanvasContext() as unknown as CanvasRenderingContext2D,
    );
  });

  it('참고 사진이 없어도 가이드와 얼굴 만들기를 사용하고 중앙선을 끌 수 있다', () => {
    render(<SketchEditor ariaLabel="그리기 캔버스" />);
    openTools();

    const guide = screen.getByRole('button', { name: '가이드' });
    expect(guide).toBeEnabled();
    fireEvent.click(guide);
    expect(screen.getByRole('tab', { name: '사진 참고' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('tab', { name: '얼굴 만들기' })).toBeEnabled();
    expect(screen.getByTestId('canvas-crosshair')).toBeVisible();

    fireEvent.click(screen.getByRole('checkbox', { name: '중앙선 보기' }));
    expect(screen.queryByTestId('canvas-crosshair')).not.toBeInTheDocument();
  });

  it('얼굴 선택 순서를 유지하고 손그림 삭제와 얼굴 초기화를 분리한다', () => {
    const context = createCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    const { container } = render(<SketchEditor ariaLabel="그리기 캔버스" />);
    openTools();
    openFaceBuilder();

    fireEvent.click(screen.getByRole('button', { name: '갸름한 얼굴' }));
    fireEvent.click(screen.getByRole('tab', { name: '눈' }));
    fireEvent.click(screen.getByRole('button', { name: '부드러운 눈' }));

    const stageParts = [...container.querySelectorAll<HTMLImageElement>('.face-guide-part')];
    expect(stageParts.map((image) => image.getAttribute('src'))).toEqual([
      expect.stringContaining('/guides/face-parts/face/oval.webp'),
      expect.stringContaining('/guides/face-parts/eyes/gentle.webp'),
    ]);

    fireEvent.click(screen.getByRole('button', { name: '그리기' }));
    fireEvent.click(screen.getByRole('button', { name: '전체 삭제' }));
    expect(container.querySelectorAll('.face-guide-part')).toHaveLength(2);
    const clearCount = context.clearRect.mock.calls.length;

    openFaceBuilder();
    fireEvent.click(screen.getByRole('button', { name: '얼굴 초기화' }));
    expect(container.querySelectorAll('.face-guide-part')).toHaveLength(0);
    expect(context.clearRect).toHaveBeenCalledTimes(clearCount);
  });

  it('얼굴만 선택해도 합성 결과를 확인할 수 있다', async () => {
    const onDrawingChange = vi.fn();
    class TestImage {
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal('Image', TestImage);
    const { container } = render(
      <SketchEditor ariaLabel="그리기 캔버스" onDrawingChange={onDrawingChange} />,
    );
    openTools();
    openFaceBuilder();
    fireEvent.click(screen.getByRole('button', { name: '갸름한 얼굴' }));
    const stagePart = container.querySelector<HTMLImageElement>('.face-guide-part');
    expect(stagePart).not.toBeNull();
    fireEvent.load(stagePart!);

    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => expect(onDrawingChange).toHaveBeenCalledWith('data:image/webp;base64,result'));
    expect(screen.getByRole('img', { name: '그린 그림 미리보기' })).toBeVisible();
  });

  it('저장하지 않은 얼굴 조합도 나가기 전에 확인한다', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SketchEditor ariaLabel="그리기 캔버스" />);
    openTools();
    openFaceBuilder();
    fireEvent.click(screen.getByRole('button', { name: '갸름한 얼굴' }));

    fireEvent.click(screen.getByRole('button', { name: '그리기 나가기' }));

    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: '전체 화면 그리기' })).toBeVisible();
  });
});
