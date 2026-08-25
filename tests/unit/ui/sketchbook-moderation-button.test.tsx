import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

import { SketchbookModerationButton } from '@/app/admin/(protected)/sketchbooks/[sketchbookId]/SketchbookModerationButton';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SketchbookModerationButton', () => {
  it('확인 대화상자에서 정확한 운영 상태를 PATCH하고 상세를 새로고침한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    render(<SketchbookModerationButton moderationStatus="ACTIVE" sketchbookId="book-1" />);

    fireEvent.click(screen.getByRole('button', { name: '서비스에서 비활성화' }));
    expect(screen.getByRole('dialog', { name: '스케치북을 비활성화할까요?' }))
      .toHaveAttribute('aria-modal', 'true');
    fireEvent.click(screen.getByRole('button', { name: '비활성화하기' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/sketchbooks/book-1/moderation',
      {
        body: JSON.stringify({ moderationStatus: 'BLOCKED' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      },
    ));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('비활성 스케치북은 해제 용어와 ACTIVE payload를 사용한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    render(<SketchbookModerationButton moderationStatus="BLOCKED" sketchbookId="book-1" />);

    fireEvent.click(screen.getByRole('button', { name: '비활성화 해제' }));
    expect(screen.getByRole('dialog', { name: '스케치북 비활성화를 해제할까요?' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '비활성화 해제하기' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/sketchbooks/book-1/moderation',
      expect.objectContaining({
        body: JSON.stringify({ moderationStatus: 'ACTIVE' }),
        method: 'PATCH',
      }),
    ));
  });

  it('대화상자에 포커스를 두고 Escape로 닫은 뒤 실행 버튼으로 복귀한다', () => {
    render(<SketchbookModerationButton moderationStatus="ACTIVE" sketchbookId="book-1" />);

    const trigger = screen.getByRole('button', { name: '서비스에서 비활성화' });
    fireEvent.click(trigger);

    const closeButton = screen.getByRole('button', { name: '상태 변경 닫기' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('포커스가 대화상자의 첫 버튼과 마지막 버튼 사이를 순환한다', () => {
    render(<SketchbookModerationButton moderationStatus="ACTIVE" sketchbookId="book-1" />);
    fireEvent.click(screen.getByRole('button', { name: '서비스에서 비활성화' }));

    const closeButton = screen.getByRole('button', { name: '상태 변경 닫기' });
    const confirmButton = screen.getByRole('button', { name: '비활성화하기' });
    closeButton.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
    expect(confirmButton).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(closeButton).toHaveFocus();
  });

  it('처리 중에는 닫기와 중복 확인을 잠그고 Escape도 무시한다', async () => {
    let resolveRequest: ((value: { ok: boolean }) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
      resolveRequest = resolve;
    })));
    render(<SketchbookModerationButton moderationStatus="ACTIVE" sketchbookId="book-1" />);
    fireEvent.click(screen.getByRole('button', { name: '서비스에서 비활성화' }));
    fireEvent.click(screen.getByRole('button', { name: '비활성화하기' }));

    expect(await screen.findByRole('button', { name: '처리 중…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '상태 변경 닫기' })).toBeDisabled();
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(1);

    resolveRequest?.({ ok: true });
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('서버와 네트워크 오류를 비밀값 없는 일반 안내로 표시하고 다시 시도할 수 있다', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({ message: 'SECRET_TOKEN=top-secret' }),
        ok: false,
      })
      .mockRejectedValueOnce(new Error('PRIVATE_FIREBASE_PROJECT'));
    vi.stubGlobal('fetch', fetchMock);
    render(<SketchbookModerationButton moderationStatus="ACTIVE" sketchbookId="book-1" />);
    fireEvent.click(screen.getByRole('button', { name: '서비스에서 비활성화' }));
    const confirm = screen.getByRole('button', { name: '비활성화하기' });

    fireEvent.click(confirm);

    expect(await screen.findByRole('alert')).toHaveTextContent('상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('SECRET_TOKEN');
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('alert')).not.toHaveTextContent('PRIVATE_FIREBASE_PROJECT');
    expect(confirm).toBeEnabled();
  });

  it('스케치북 ID를 안전한 API 경로 세그먼트로 보낸다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <SketchbookModerationButton
        moderationStatus="ACTIVE"
        sketchbookId="book/../javascript:alert(1)"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '서비스에서 비활성화' }));
    fireEvent.click(screen.getByRole('button', { name: '비활성화하기' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/sketchbooks/book%2F..%2Fjavascript%3Aalert(1)/moderation',
      expect.any(Object),
    ));
  });
});
