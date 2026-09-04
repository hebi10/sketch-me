import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { CreateCompleteActions } from '@/app/create/CreateCompleteActions';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

describe('CreateCompleteActions', () => {
  it('공유 API가 없으면 공개 링크를 복사하고 상태를 알린다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText }, share: undefined });

    render(<CreateCompleteActions manageUrl="/m/abc" publicUrl="/s/abc" />);
    fireEvent.click(screen.getByRole('button', { name: '친구에게 공유하기' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/abc`));
    expect(screen.getByRole('status')).toHaveTextContent('친구에게 보낼 링크를 복사했어요.');
  });
});
