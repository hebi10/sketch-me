import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';

import { ManageDashboard } from '@/app/m/[publicId]/ManageDashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

describe('ManageDashboard 친구 그림 추가 결제', () => {
  it('원본과 친구 그림이 준비될 때까지 개별 로딩 상태를 표시한다', async () => {
    const createdAt = new Date('2026-08-25T00:00:00.000Z');
    render(
      <ManageDashboard
        drawings={[{
          authorName: '친구',
          bestRank: null,
          createdAt,
          id: 'loading-drawing',
          imagePath: 'sketchbooks/book-1/drawings/loading.webp',
          publicImageVersion: 'version-1',
          thumbnailPath: null,
          message: null,
          moderatedAt: null,
          moderationStatus: 'ACTIVE',
          sketchbookId: 'book-1',
          sketchbookName: '내 이름',
          sketchbookPublicId: 'public-loading',
          status: 'VISIBLE',
          updatedAt: createdAt,
          usedReferenceImage: false,
        }]}
        moderationStatus="ACTIVE"
        name="내 이름"
        ownerDrawingPath="sketchbooks/book-1/owner/original.webp"
        participantCount={1}
        participantLimit={20}
        publicId="public-loading"
      />,
    );

    expect(screen.getAllByRole('status', { name: '그림 불러오는 중' })).toHaveLength(2);

    fireEvent.load(screen.getByRole('img', { name: '직접 그린 내 모습' }));
    await waitFor(() => expect(screen.getAllByRole('status', { name: '그림 불러오는 중' })).toHaveLength(1));

    fireEvent.load(screen.getByRole('img', { name: '친구님의 그림' }));
    await waitFor(() => expect(screen.queryByRole('status', { name: '그림 불러오는 중' })).not.toBeInTheDocument());
  });

  it('친구 그림을 불러오지 못하면 로딩 표시 대신 오류를 안내한다', () => {
    const createdAt = new Date('2026-08-25T00:00:00.000Z');
    render(
      <ManageDashboard
        drawings={[{
          authorName: '친구',
          bestRank: null,
          createdAt,
          id: 'failed-drawing',
          imagePath: 'sketchbooks/book-1/drawings/failed.webp',
          publicImageVersion: 'version-1',
          thumbnailPath: null,
          message: null,
          moderatedAt: null,
          moderationStatus: 'ACTIVE',
          sketchbookId: 'book-1',
          sketchbookName: '내 이름',
          sketchbookPublicId: 'public-failed',
          status: 'VISIBLE',
          updatedAt: createdAt,
          usedReferenceImage: false,
        }]}
        moderationStatus="ACTIVE"
        name="내 이름"
        participantCount={1}
        participantLimit={20}
        publicId="public-failed"
      />,
    );

    fireEvent.error(screen.getByRole('img', { name: '친구님의 그림' }));

    expect(screen.getByRole('alert')).toHaveTextContent('그림을 불러오지 못했어요.');
    expect(screen.queryByRole('status', { name: '그림 불러오는 중' })).not.toBeInTheDocument();
  });

  it('관리 메뉴를 이미지 없이 짧은 한글 문구로 표시한다', () => {
    render(
      <ManageDashboard
        drawings={[]}
        moderationStatus="ACTIVE"
        name="내 이름"
        participantCount={0}
        participantLimit={20}
        publicId="public-menu"
      />,
    );
    const menu = screen.getByRole('navigation', { name: '메뉴 항목' });

    const items = [
      ['친구 페이지 보기', '친구홈'],
      ['스토리 이미지 만들기', '스토리'],
      ['친구에게 공유하기', '공유'],
      ['관리 비밀번호 변경', '비밀번호'],
      ['로그아웃', '로그아웃'],
    ] as const;

    items.forEach(([name, shortLabel]) => {
      const control = within(menu).getByRole(name === '친구 페이지 보기' || name === '스토리 이미지 만들기' ? 'link' : 'button', { name });
      expect(control).toHaveTextContent(shortLabel);
    });
    expect(menu.querySelector('img')).not.toBeInTheDocument();
  });

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
          publicImageVersion: 'version-1',
          thumbnailPath: null,
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
        moderationStatus="ACTIVE"
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

  it('직접 그린 내 모습이 있으면 친구 그림 목록보다 먼저 보여준다', () => {
    render(
      <ManageDashboard
        drawings={[]}
        moderationStatus="ACTIVE"
        name="내 이름"
        ownerDrawingPath="sketchbooks/book-1/owner/original.webp"
        participantCount={0}
        participantLimit={20}
        publicId="public-1"
      />,
    );

    expect(screen.getByRole('img', { name: '직접 그린 내 모습' })).toHaveAttribute(
      'src',
      expect.stringContaining('/api/manage/public-1/owner/image'),
    );
    expect(screen.getByRole('img', { name: '직접 그린 내 모습' })).toHaveAttribute('loading', 'eager');
  });

  it('직접 그린 내 모습이 없으면 원본 영역을 표시하지 않는다', () => {
    render(
      <ManageDashboard
        drawings={[]}
        moderationStatus="ACTIVE"
        name="내 이름"
        ownerDrawingPath={null}
        participantCount={0}
        participantLimit={20}
        publicId="public-1"
      />,
    );

    expect(screen.queryByRole('img', { name: '직접 그린 내 모습' })).not.toBeInTheDocument();
  });

  it('인원 상품을 선택해 새 가격으로 모의 결제하고 참여 한도를 갱신한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ entitlements: { watermarkFree: false }, participantLimit: 70 }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ManageDashboard
        drawings={[]}
        moderationStatus="ACTIVE"
        name="내 이름"
        participantCount={5}
        participantLimit={20}
        publicId="public-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '친구 그림 더 추가하기' }));
    const dialog = screen.getByRole('dialog', { name: '상품 선택하기' });
    expect(dialog).toBeVisible();
    expect(screen.getByRole('radio', { name: /10명 추가.*990원/ })).toBeChecked();
    expect(screen.getByRole('link', { name: '서비스 이용 및 결제 안내' })).toHaveAttribute('href', '/terms');

    expect(screen.getByRole('group', { name: '친구 인원 추가' })).toBeVisible();
    expect(screen.getByRole('group', { name: '결과 이미지' })).toBeVisible();
    fireEvent.click(screen.getByRole('radio', { name: /50명 추가.*4,490원/ }));
    fireEvent.click(screen.getByRole('button', { name: '4,490원 모의 결제하기' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/manage/public-1/purchase', {
      body: expect.stringMatching(/"productId":"FRIENDS_50","requestId":"[^"]+"/),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }));
    expect(await screen.findByText('모의 결제가 완료되어 친구 그림 50개가 추가됐어요.')).toBeVisible();
    expect(screen.getByText((_, element) => element?.textContent === '친구 그림 5 / 70')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('워터마크 제거 결제는 인원 한도를 유지하고 적용 상태를 즉시 표시한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ entitlements: { watermarkFree: true }, participantLimit: 20 }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ManageDashboard
        drawings={[]}
        entitlements={{ watermarkFree: false }}
        moderationStatus="ACTIVE"
        name="내 이름"
        participantCount={5}
        participantLimit={20}
        publicId="watermark-book"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '친구 그림 더 추가하기' }));
    fireEvent.click(screen.getByRole('radio', { name: /워터마크 제거.*990원/ }));
    fireEvent.click(screen.getByRole('button', { name: '990원 모의 결제하기' }));

    expect(await screen.findByText('워터마크 제거가 적용됐어요.')).toBeVisible();
    expect(screen.getByText((_, element) => element?.textContent === '친구 그림 5 / 20')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '친구 그림 더 추가하기' }));
    expect(screen.getByText('적용됨')).toBeVisible();
    expect(screen.getByRole('radio', { name: /워터마크 제거.*적용됨/ })).toBeDisabled();
  });

  it('결제 연결에 실패하면 팝업을 유지하고 다시 시도할 수 있다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failed')));

    render(
      <ManageDashboard
        drawings={[]}
        moderationStatus="ACTIVE"
        name="내 이름"
        participantCount={5}
        participantLimit={20}
        publicId="public-2"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '친구 그림 더 추가하기' }));
    fireEvent.click(screen.getByRole('button', { name: '990원 모의 결제하기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('결제 연결을 확인하고 다시 시도해 주세요.');
    expect(screen.getByRole('dialog', { name: '상품 선택하기' })).toBeVisible();
    expect(screen.getByRole('button', { name: '990원 모의 결제하기' })).toBeEnabled();
  });

  it('결제창에 포커스를 두고 닫으면 실행 버튼으로 복귀한다', () => {
    render(
      <ManageDashboard
        drawings={[]}
        moderationStatus="ACTIVE"
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

  it('관리 비밀번호 변경을 네이티브 dialog로 열고 Escape 뒤 실행 버튼에 포커스를 되돌린다', () => {
    render(
      <ManageDashboard
        drawings={[]}
        moderationStatus="ACTIVE"
        name="내 이름"
        participantCount={5}
        participantLimit={20}
        publicId="public-4"
      />,
    );

    const trigger = screen.getByRole('button', { name: '관리 비밀번호 변경' });
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: '관리 비밀번호 변경' });
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog.querySelector('form')).toHaveClass('manage-security-form');
    expect(screen.getByRole('main')).toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: '비밀번호 변경 닫기' })).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: '관리 비밀번호 변경' })).not.toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveAttribute('inert');
    expect(trigger).toHaveFocus();
  });

  it('관리 화면의 운영 데이터는 시스템 고딕체 범위로 표시한다', () => {
    render(
      <ManageDashboard
        drawings={[]}
        moderationStatus="ACTIVE"
        name="내 이름"
        participantCount={5}
        participantLimit={20}
        publicId="public-5"
      />,
    );

    expect(screen.getByRole('main')).toHaveClass('manage-system-sans');
  });
});
