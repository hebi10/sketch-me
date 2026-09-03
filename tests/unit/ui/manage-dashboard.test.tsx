import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';

import { ManageDashboard } from '@/app/m/[publicId]/ManageDashboard';

const { getPublicPaymentMode } = vi.hoisted(() => ({ getPublicPaymentMode: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/purchases/mode', () => ({ getPublicPaymentMode }));

describe('ManageDashboard 친구 그림 추가 결제', () => {
  beforeEach(() => {
    getPublicPaymentMode.mockReturnValue('MOCK');
  });

  it('기존 비활성 설정이 남아 있어도 구매 행동을 제공한다', () => {
    getPublicPaymentMode.mockReturnValue('DISABLED');

    render(
      <ManageDashboard
        drawings={[]}
        moderationStatus="ACTIVE"
        name="내 이름"
        participantCount={5}
        participantLimit={20}
        publicId="payment-disabled"
      />,
    );

    expect(screen.getByRole('button', { name: '저장 공간 추가하기' })).toBeEnabled();
    expect(screen.queryByRole('status', { name: '결제 기능 준비 중' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '상품 선택하기' })).not.toBeInTheDocument();
  });

  it('내 그림과 공개 중인 1위 그림 중 링크 공유 썸네일을 선택해 저장한다', async () => {
    const createdAt = new Date('2026-08-25T00:00:00.000Z');
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ shareThumbnailMode: 'BEST_1' }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ManageDashboard
        drawings={[{
          authorName: '친구',
          bestRank: 1,
          createdAt,
          id: 'best-drawing',
          imagePath: 'sketchbooks/book-1/drawings/best.webp',
          publicImageVersion: 'version-1',
          thumbnailPath: null,
          message: null,
          moderatedAt: null,
          moderationStatus: 'ACTIVE',
          sketchbookId: 'book-1',
          sketchbookName: '내 이름',
          sketchbookPublicId: 'public-1',
          status: 'VISIBLE',
          updatedAt: createdAt,
        }]}
        moderationStatus="ACTIVE"
        name="내 이름"
        ownerDrawingPath="sketchbooks/book-1/owner/original.webp"
        participantCount={1}
        participantLimit={20}
        publicId="public-1"
        shareThumbnailMode="OWNER"
        shareThumbnailVersion="owner-version"
      />,
    );

    expect(screen.getByRole('radio', { name: '내가 그린 그림' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: '1위 그림' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/manage/public-1/sketchbook', {
      body: JSON.stringify({ shareThumbnailMode: 'BEST_1' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    }));
    expect(screen.getByRole('radio', { name: '1위 그림' })).toBeChecked();
    expect(screen.getByText('링크 공유 썸네일을 변경했어요.')).toBeVisible();
  });

  it('기본 썸네일을 다시 선택해 저장한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ shareThumbnailMode: 'DEFAULT' }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ManageDashboard
        drawings={[]}
        moderationStatus="ACTIVE"
        name="내 이름"
        ownerDrawingPath="sketchbooks/book-1/owner/original.webp"
        participantCount={0}
        participantLimit={20}
        publicId="public-default"
        shareThumbnailMode="OWNER"
        shareThumbnailVersion="owner-version"
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: '기본 썸네일' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/manage/public-default/sketchbook', {
      body: JSON.stringify({ shareThumbnailMode: 'DEFAULT' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    }));
    expect(screen.getByRole('radio', { name: '기본 썸네일' })).toBeChecked();
  });

  it('원본이 없는 링크 공유 썸네일 선택지는 비활성화한다', () => {
    render(
      <ManageDashboard
        drawings={[]}
        moderationStatus="ACTIVE"
        name="내 이름"
        participantCount={0}
        participantLimit={20}
        publicId="public-empty"
      />,
    );

    expect(screen.getByRole('radio', { name: '기본 썸네일' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '기본 썸네일' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: '내가 그린 그림' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: '1위 그림' })).toBeDisabled();
  });

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
      ['관리용 비밀번호 변경', '비밀번호'],
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
        }]}
        moderationStatus="ACTIVE"
        name="내 이름"
        participantCount={1}
        participantLimit={20}
        publicId="public-1"
      />,
    );

    expect(screen.getByText('운영자 숨김')).toBeVisible();
    fireEvent.click(screen.getByText('순위 선택'));
    expect(screen.getByRole('button', { name: '친구 페이지에서 숨기기' })).toBeDisabled();
    screen.getAllByRole('button', { name: /^[1-4]위$/ }).forEach((button) => {
      expect(button).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'BEST 해제' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '그림 삭제' })).toBeEnabled();
  });

  it('내 그림을 친구 그림보다 먼저 순위 후보로 보여주고 수동 순위만 표시한다', () => {
    render(
      <ManageDashboard
        drawings={[]}
        moderationStatus="ACTIVE"
        name="내 이름"
        ownerBestRank={2}
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
    const ownerCard = screen.getByRole('img', { name: '직접 그린 내 모습' }).closest('article');
    expect(ownerCard).not.toBeNull();
    expect(within(ownerCard as HTMLElement).getByText('내 그림')).toBeVisible();
    expect(within(ownerCard as HTMLElement).getByText('BEST 2')).toBeVisible();
    fireEvent.click(within(ownerCard as HTMLElement).getByText('순위 선택'));
    expect(within(ownerCard as HTMLElement).getByRole('button', { name: '2위' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(ownerCard as HTMLElement).getByRole('button', { name: 'BEST 해제' })).toBeEnabled();
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

  it('그림 순위 선택 영역을 공유 화면 링크의 목적지로 제공한다', () => {
    render(
      <ManageDashboard
        drawings={[]}
        moderationStatus="ACTIVE"
        name="내 이름"
        participantCount={0}
        participantLimit={20}
        publicId="public-1"
      />,
    );

    expect(screen.getByRole('region', { name: '그림 순위 선택' })).toHaveAttribute(
      'id',
      'drawing-ranking',
    );
  });

  it('인원 상품 결제를 완료하면 참여 한도를 갱신하고 모의 결제 완료 팝업을 표시한다', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: '저장 공간 추가하기' }));
    const dialog = screen.getByRole('dialog', { name: '상품 선택하기' });
    expect(dialog).toBeVisible();
    expect(screen.getByRole('radio', { name: /10명 추가.*990원/ })).toBeChecked();
    expect(screen.getByRole('link', { name: '서비스 이용 및 결제 안내' })).toHaveAttribute('href', '/terms');

    expect(screen.getByRole('group', { name: '친구 인원 추가' })).toBeVisible();
    expect(screen.getByRole('group', { name: '결과 이미지' })).toBeVisible();
    fireEvent.click(screen.getByRole('radio', { name: /50명 추가.*4,490원/ }));
    expect(screen.queryByText(/모의 결제/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '4,490원 결제하기' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/manage/public-1/purchase', {
      body: expect.stringMatching(/"productId":"FRIENDS_50","requestId":"[^"]+"/),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }));
    const successDialog = await screen.findByRole('dialog', { name: '결제 완료' });
    expect(within(successDialog).getByText('모의 결제가 완료됐습니다')).toBeVisible();
    expect(within(successDialog).getByText('친구 그림 50명이 추가됐어요.')).toBeVisible();
    expect(screen.getByText((_, element) => element?.textContent === '친구 그림 5 / 70')).toBeVisible();
    fireEvent.click(within(successDialog).getByRole('button', { name: '확인' }));
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

    fireEvent.click(screen.getByRole('button', { name: '저장 공간 추가하기' }));
    fireEvent.click(screen.getByRole('radio', { name: /워터마크 제거.*990원/ }));
    fireEvent.click(screen.getByRole('button', { name: '990원 결제하기' }));

    const successDialog = await screen.findByRole('dialog', { name: '결제 완료' });
    expect(within(successDialog).getByText('모의 결제가 완료됐습니다')).toBeVisible();
    expect(within(successDialog).getByText('워터마크 제거가 적용됐어요.')).toBeVisible();
    expect(screen.getByText((_, element) => element?.textContent === '친구 그림 5 / 20')).toBeVisible();
    fireEvent.click(within(successDialog).getByRole('button', { name: '확인' }));

    fireEvent.click(screen.getByRole('button', { name: '저장 공간 추가하기' }));
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

    fireEvent.click(screen.getByRole('button', { name: '저장 공간 추가하기' }));
    fireEvent.click(screen.getByRole('button', { name: '990원 결제하기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('결제 연결을 확인하고 다시 시도해 주세요.');
    expect(screen.getByRole('dialog', { name: '상품 선택하기' })).toBeVisible();
    expect(screen.getByRole('button', { name: '990원 결제하기' })).toBeEnabled();
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

    const trigger = screen.getByRole('button', { name: '저장 공간 추가하기' });
    fireEvent.click(trigger);

    expect(screen.getByRole('main')).toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: '결제창 닫기' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: '결제창 닫기' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveAttribute('inert');
    expect(trigger).toHaveFocus();
  });

  it('관리용 비밀번호 변경을 네이티브 dialog로 열고 Escape 뒤 실행 버튼에 포커스를 되돌린다', () => {
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

    const trigger = screen.getByRole('button', { name: '관리용 비밀번호 변경' });
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: '관리용 비밀번호 변경' });
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog.querySelector('form')).toHaveClass('manage-security-form');
    expect(screen.getByRole('main')).toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: '비밀번호 변경 닫기' })).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: '관리용 비밀번호 변경' })).not.toBeInTheDocument();
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
