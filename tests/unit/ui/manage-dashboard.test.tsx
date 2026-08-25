import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { ManageDashboard } from '@/app/m/[publicId]/ManageDashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

describe('ManageDashboard 친구 그림 추가 결제', () => {
  it('운영자 숨김 그림은 삭제만 허용하고 공개와 BEST 조작을 비활성화한다', () => {
    const createdAt = new Date('2026-08-25T00:00:00.000Z');
    render(
      <ManageDashboard
        drawings={[{
          authorName: '친구',
          bestRank: 1,
          createdAt,
          id: 'blocked-drawing',
          imagePath: 'sketchbooks/book-1/drawings/blocked.webp',
          message: null,
          moderatedAt: createdAt,
          moderationStatus: 'BLOCKED',
          sketchbookId: 'book-1',
          sketchbookName: '내 이름',
          sketchbookPublicId: 'public-1',
          status: 'VISIBLE',
          updatedAt: createdAt,
          usedReferenceImage: false,
        }]}
        name="내 이름"
        participantCount={1}
        participantLimit={20}
        publicId="public-1"
      />,
    );

    expect(screen.getByText('운영자 숨김')).toBeVisible();
    fireEvent.click(screen.getByText('그림 관리'));
    expect(screen.getByRole('button', { name: '친구 페이지에서 숨기기' })).toBeDisabled();
    screen.getAllByRole('button', { name: /^[1-4]$/ }).forEach((button) => {
      expect(button).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'BEST 해제' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '그림 삭제' })).toBeEnabled();
  });

  it('내가 그린 원본이 있으면 친구 그림 목록보다 먼저 보여준다', () => {
    render(
      <ManageDashboard
        drawings={[]}
        name="내 이름"
        ownerDrawingPath="sketchbooks/book-1/owner/original.webp"
        participantCount={0}
        participantLimit={20}
        publicId="public-1"
      />,
    );

    expect(screen.getByRole('img', { name: '내가 그린 원본' })).toHaveAttribute(
      'src',
      expect.stringContaining('/api/sketchbooks/public-1/owner/image'),
    );
  });

  it('내가 그린 원본이 없으면 원본 영역을 표시하지 않는다', () => {
    render(
      <ManageDashboard
        drawings={[]}
        name="내 이름"
        ownerDrawingPath={null}
        participantCount={0}
        participantLimit={20}
        publicId="public-1"
      />,
    );

    expect(screen.queryByRole('img', { name: '내가 그린 원본' })).not.toBeInTheDocument();
  });

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
