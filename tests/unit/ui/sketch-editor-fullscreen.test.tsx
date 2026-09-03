import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { SketchEditor } from '@/components/sketch/SketchEditor';

describe('SketchEditor 전체 화면 모드', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    } as unknown as CanvasRenderingContext2D);
  });

  it('빈 캔버스에서 나가기 버튼을 누르면 진입 버튼으로 포커스를 돌려준다', () => {
    render(<SketchEditor ariaLabel="그리기 캔버스" />);

    const entry = screen.getByRole('button', { name: '그림 그리기' });
    fireEvent.click(entry);

    const exit = screen.getByRole('button', { name: '그리기 나가기' });
    expect(exit).toBeVisible();
    fireEvent.click(exit);

    expect(screen.queryByRole('dialog', { name: '전체 화면 그리기' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '그림 그리기' })).toHaveFocus();
  });

  it('그림이 있으면 나가기와 Escape 모두 같은 확인 절차를 거친다', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
    } as unknown as CanvasRenderingContext2D);
    render(<SketchEditor ariaLabel="그리기 캔버스" />);

    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    fireEvent.click(screen.getByRole('button', { name: '그리기 나가기' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: '전체 화면 그리기' })).toBeVisible();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog', { name: '전체 화면 그리기' })).not.toBeInTheDocument();
  });

  it('전체 화면에서 그린 뒤 확인하면 읽기 전용 미리보기로 돌아간다', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
    } as unknown as CanvasRenderingContext2D);
    render(<div><button type="button">외부 버튼</button><SketchEditor ariaLabel="그리기 캔버스" /></div>);

    const entry = screen.getByRole('button', { name: '그림 그리기' });
    fireEvent.click(entry);
    expect(screen.getByRole('dialog', { name: '전체 화면 그리기' })).toBeVisible();
    expect(screen.getByRole('button', { name: '확인' })).toHaveFocus();
    expect(screen.getByRole('button', { name: '외부 버튼' })).toHaveAttribute('inert');
    expect(screen.getByRole('navigation', { hidden: true, name: '그림 편집 단계' })).not.toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '그리기 도구 열기' }));
    expect(screen.getByRole('navigation', { name: '그림 편집 단계' })).toBeVisible();
    expect(screen.getByRole('button', { name: '그리기 도구 닫기' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '전체 화면 그리기' })).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: '그림 그리기' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: '그린 그림 미리보기' })).toBeVisible();
    expect(screen.getByRole('button', { name: '외부 버튼' })).not.toHaveAttribute('inert');
  });

  it('확인, 한 단계 이전, 나가기 동작만 이미지 아이콘으로 표시한다', () => {
    render(<SketchEditor ariaLabel="그리기 캔버스" />);

    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));

    const confirmButton = screen.getByRole('button', { name: '확인' });
    const undoButton = screen.getByRole('button', { name: '그림 기록 한 단계 이전' });
    const exitButton = screen.getByRole('button', { name: '그리기 나가기' });
    expect(confirmButton).not.toHaveTextContent('확인');
    expect(confirmButton.querySelector('img')).toHaveAttribute('src', expect.stringContaining('fullscreen-confirm.webp'));
    expect(undoButton).not.toHaveTextContent('그림 기록 한 단계 이전');
    expect(undoButton.querySelector('img')).toHaveAttribute('src', expect.stringContaining('fullscreen-back.webp'));
    expect(exitButton).not.toHaveTextContent('그리기 나가기');
    expect(exitButton.querySelector('img')).toHaveAttribute('src', expect.stringContaining('fullscreen-exit.webp'));
    expect(screen.queryByLabelText('완성된 그림 불러오기')).not.toBeInTheDocument();
  });
});
