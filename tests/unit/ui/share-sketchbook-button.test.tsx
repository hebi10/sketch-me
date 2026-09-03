import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { ShareSketchbookButton } from '@/app/m/[publicId]/ShareSketchbookButton';

describe('ShareSketchbookButton', () => {
  it('copies the public link when Web Share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    render(<ShareSketchbookButton name="테스트" publicId="public-1" />);
    fireEvent.click(screen.getByRole('button', { name: '공유하기' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/public-1`));
    expect(screen.getByRole('status')).toHaveTextContent('링크를 복사했어요.');
  });

  it('링크 썸네일 버전을 공유 URL에 포함해 변경된 미리보기를 새로 스크랩하게 한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    render(<ShareSketchbookButton name="테스트" previewVersion="drawing-1-version-1" publicId="public-1" />);
    fireEvent.click(screen.getByRole('button', { name: '공유하기' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/s/public-1?preview=drawing-1-version-1`,
    ));
  });

  it('copies the public link when opening Web Share fails', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('공유할 수 없음', 'NotAllowedError'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    render(<ShareSketchbookButton name="테스트" publicId="public-2" />);
    fireEvent.click(screen.getByRole('button', { name: '공유하기' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/public-2`));
    expect(screen.getByRole('status')).toHaveTextContent('공유창을 열지 못해 링크를 복사했어요.');
  });
});
