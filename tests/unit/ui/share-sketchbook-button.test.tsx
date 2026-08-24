import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { ShareSketchbookButton } from '@/app/m/[publicId]/ShareSketchbookButton';

describe('ShareSketchbookButton', () => {
  it('copies the public link when Web Share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    render(<ShareSketchbookButton name="테스트" publicId="public-1" />);
    fireEvent.click(screen.getByRole('button', { name: '친구에게 공유하기' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/public-1`));
    expect(screen.getByRole('status')).toHaveTextContent('링크를 복사했어요.');
  });
});
