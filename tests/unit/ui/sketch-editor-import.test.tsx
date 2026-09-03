import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { SketchEditor } from '@/components/sketch/SketchEditor';

describe('SketchEditor 그림 가져오기 제거', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    } as unknown as CanvasRenderingContext2D);
  });

  it('전체 화면 그리기에서 파일 입력을 표시하지 않는다', () => {
    render(<SketchEditor ariaLabel="그리기 캔버스" />);

    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));

    expect(screen.queryByLabelText('완성된 그림 불러오기')).not.toBeInTheDocument();
  });
});
