import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { SketchEditor } from '@/components/sketch/SketchEditor';

describe('SketchEditor 진행 중 그림 보존', () => {
  let hasPixels: boolean;
  let clearRect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    hasPixels = false;
    clearRect = vi.fn(() => { hasPixels = false; });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => hasPixels ? 'data:image/png;base64,stroke' : 'data:image/png;base64,blank');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      beginPath: vi.fn(), clearRect, drawImage: vi.fn(() => { hasPixels = true; }),
      fillRect: vi.fn(), lineTo: vi.fn(), moveTo: vi.fn(), stroke: vi.fn(() => { hasPixels = true; }),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, hasPixels ? 255 : 0]) })),
      putImageData: vi.fn((pixels: ImageData) => { hasPixels = pixels.data[3] > 0; }),
    } as unknown as CanvasRenderingContext2D);
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      set src(_value: string) { this.onload?.(); }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function drawStroke() {
    const canvas = screen.getByLabelText('그리기 캔버스');
    Object.defineProperty(canvas, 'setPointerCapture', { configurable: true, value: vi.fn() });
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 100, left: 0, top: 0 } as DOMRect);
    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
  }

  it('확인 전 완료한 획을 부모에 전달하고 부모가 돌려준 초안으로 캔버스를 덮어쓰지 않는다', () => {
    function DraftParent() {
      const [draft, setDraft] = useState<string | null>(null);
      return <><output aria-label="저장된 초안">{draft}</output><SketchEditor ariaLabel="그리기 캔버스" initialDrawingDataUrl={draft} onDrawingChange={setDraft} /></>;
    }
    render(<DraftParent />);
    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    drawStroke();

    expect(screen.getByLabelText('저장된 초안')).toHaveTextContent('data:image/png;base64,stroke');
    expect(clearRect).not.toHaveBeenCalledWith(0, 0, 720, 720);
    expect(screen.getByRole('button', { name: '그림 기록 한 단계 이전' })).toBeEnabled();
    expect(screen.getByRole('dialog', { name: '전체 화면 그리기' })).toBeVisible();
  });

  it('그리기를 취소하면 폐기한 획을 초안에서도 지운다', () => {
    const onDrawingChange = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SketchEditor ariaLabel="그리기 캔버스" onDrawingChange={onDrawingChange} />);
    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    drawStroke();
    fireEvent.click(screen.getByRole('button', { name: '그리기 나가기' }));

    expect(onDrawingChange).toHaveBeenLastCalledWith(null);
  });

  it('다시 편집하다 취소하면 확인했던 그림을 유지한다', () => {
    const onDrawingChange = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SketchEditor ariaLabel="그리기 캔버스" onDrawingChange={onDrawingChange} reopenLabel="그림 수정하기" />);
    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    drawStroke();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    fireEvent.click(screen.getByRole('button', { name: '그림 수정하기' }));
    fireEvent.click(screen.getByRole('button', { name: '그리기 나가기' }));

    expect(hasPixels).toBe(true);
    expect(onDrawingChange).toHaveBeenLastCalledWith('data:image/png;base64,stroke');
    expect(screen.getByRole('button', { name: '그림 수정하기' })).toHaveFocus();
  });

  it('재편집 버튼이 없는 경우 확인 후 이미지 입력으로 포커스를 복구한다', () => {
    render(<SketchEditor ariaLabel="그리기 캔버스" />);
    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    drawStroke();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    expect(screen.getByLabelText('이미지로 가져오기')).toHaveFocus();
  });

  it('서버의 기존 그림 편집을 취소해도 이미지 URL을 새 초안으로 전달하지 않는다', () => {
    const onDrawingChange = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SketchEditor ariaLabel="그리기 캔버스" initialDrawingDataUrl="/api/manage/public-1/owner/image" onDrawingChange={onDrawingChange} reopenLabel="그림 수정하기" />);
    fireEvent.click(screen.getByRole('button', { name: '그림 수정하기' }));
    drawStroke();
    fireEvent.click(screen.getByRole('button', { name: '그리기 나가기' }));

    expect(hasPixels).toBe(true);
    expect(onDrawingChange).toHaveBeenLastCalledWith(null);
  });

  it('저장소가 차단되어도 그림판을 열고 사용할 수 있다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable'); });
    render(<SketchEditor ariaLabel="그리기 캔버스" />);
    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    drawStroke();

    expect(screen.getByRole('button', { name: '그림 기록 한 단계 이전' })).toBeEnabled();
  });
});
