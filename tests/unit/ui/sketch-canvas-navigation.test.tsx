import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { SketchCanvas } from '@/app/s/[publicId]/draw/SketchCanvas';

const navigation = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
}));

describe('SketchCanvas 뒤로가기', () => {
  beforeEach(() => {
    navigation.back.mockReset();
    navigation.push.mockReset();
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,drawing');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
    } as unknown as CanvasRenderingContext2D);
  });

  it('확인했지만 제출하지 않은 그림이 있으면 이전 페이지 이동 전에 경고한다', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<SketchCanvas publicId="public-1" sketchbookName="내 이름" />);

    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    fireEvent.click(screen.getByRole('button', { name: '이전으로' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/저장하지 않은 그림/));
    expect(navigation.back).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '이전으로' }));
    expect(navigation.back).toHaveBeenCalledTimes(1);
  });
});
