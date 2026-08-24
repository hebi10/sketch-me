import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { ManageDashboard } from '@/app/m/[publicId]/ManageDashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

describe('ManageDashboard 친구 그림 추가 결제', () => {
  it('상품을 선택해 모의 결제하고 참여 한도를 갱신한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ participantLimit: 70 }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ManageDashboard
        drawings={[]}
        name="내 이름"
        participantCount={5}
        participantLimit={20}
        publicId="public-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '친구 그림 더 추가하기' }));
    const dialog = screen.getByRole('dialog', { name: '친구 그림 더 추가하기' });
    expect(dialog).toBeVisible();
    expect(screen.getByRole('radio', { name: /10명 추가.*990원/ })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: /50명 추가.*3,900원/ }));
    fireEvent.click(screen.getByRole('button', { name: '3,900원 모의 결제하기' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/manage/public-1/purchase', {
      body: expect.stringMatching(/"productId":"FRIENDS_50","requestId":"[^"]+"/),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }));
    expect(await screen.findByText('모의 결제가 완료되어 친구 그림 50개가 추가됐어요.')).toBeVisible();
    expect(screen.getByText((_, element) => element?.textContent === '친구 그림 5 / 70')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('결제 연결에 실패하면 팝업을 유지하고 다시 시도할 수 있다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failed')));

    render(
      <ManageDashboard
        drawings={[]}
        name="내 이름"
        participantCount={5}
        participantLimit={20}
        publicId="public-2"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '친구 그림 더 추가하기' }));
    fireEvent.click(screen.getByRole('button', { name: '990원 모의 결제하기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('결제 연결을 확인하고 다시 시도해 주세요.');
    expect(screen.getByRole('dialog', { name: '친구 그림 더 추가하기' })).toBeVisible();
    expect(screen.getByRole('button', { name: '990원 모의 결제하기' })).toBeEnabled();
  });

  it('결제창에 포커스를 두고 닫으면 실행 버튼으로 복귀한다', () => {
    render(
      <ManageDashboard
        drawings={[]}
        name="내 이름"
        participantCount={5}
        participantLimit={20}
        publicId="public-3"
      />,
    );

    const trigger = screen.getByRole('button', { name: '친구 그림 더 추가하기' });
    fireEvent.click(trigger);

    expect(screen.getByRole('main')).toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: '결제창 닫기' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: '결제창 닫기' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveAttribute('inert');
    expect(trigger).toHaveFocus();
  });
});
