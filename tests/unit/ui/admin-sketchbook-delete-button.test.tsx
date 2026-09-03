import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const { refresh, replace } = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, replace }),
}));

import { AdminSketchbookDeleteButton } from '@/app/admin/(protected)/sketchbooks/[sketchbookId]/AdminSketchbookDeleteButton';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderDeleteButton() {
  return render(
    <AdminSketchbookDeleteButton
      name="내 이름"
      publicId="public-1"
      sketchbookId="book-1"
    />,
  );
}

describe('AdminSketchbookDeleteButton', () => {
  it('삭제 범위를 알리고 공개 ID가 정확히 일치할 때만 영구 삭제를 허용한다', () => {
    renderDeleteButton();

    fireEvent.click(screen.getByRole('button', { name: '스케치북 완전 삭제' }));

    expect(screen.getByRole('dialog', { name: '내 이름 스케치북을 완전히 삭제할까요?' }))
      .toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/생성자와 친구 그림 파일/)).toBeVisible();
    expect(screen.getByText(/관리 세션과 모의 결제 기록/)).toBeVisible();
    expect(screen.getByText('public-1')).toBeVisible();
    const input = screen.getByRole('textbox', { name: '확인을 위해 공개 ID 입력' });
    const confirm = screen.getByRole('button', { name: '완전히 삭제하기' });
    expect(input).toHaveFocus();
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: 'public-1 ' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(input, { target: { value: 'public-1' } });
    expect(confirm).toBeEnabled();
  });

  it('확인된 스케치북을 DELETE한 뒤 관리자 목록으로 이동한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    renderDeleteButton();

    fireEvent.click(screen.getByRole('button', { name: '스케치북 완전 삭제' }));
    fireEvent.change(screen.getByRole('textbox', { name: '확인을 위해 공개 ID 입력' }), {
      target: { value: 'public-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '완전히 삭제하기' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/sketchbooks/book-1',
      {
        body: JSON.stringify({ confirmation: 'public-1' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'DELETE',
        signal: expect.any(AbortSignal),
      },
    ));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/sketchbooks'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('삭제 실패 시 비밀값을 숨기고 입력을 유지해 재시도할 수 있다', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({ message: 'SECRET_TOKEN=top-secret' }),
        ok: false,
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    renderDeleteButton();

    fireEvent.click(screen.getByRole('button', { name: '스케치북 완전 삭제' }));
    const input = screen.getByRole('textbox', { name: '확인을 위해 공개 ID 입력' });
    fireEvent.change(input, { target: { value: 'public-1' } });
    const confirm = screen.getByRole('button', { name: '완전히 삭제하기' });
    fireEvent.click(confirm);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '스케치북을 완전히 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('SECRET_TOKEN');
    expect(input).toHaveValue('public-1');
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/sketchbooks'));
  });

  it('처리 중에는 대화상자 닫기와 중복 요청을 막는다', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    renderDeleteButton();

    fireEvent.click(screen.getByRole('button', { name: '스케치북 완전 삭제' }));
    fireEvent.change(screen.getByRole('textbox', { name: '확인을 위해 공개 ID 입력' }), {
      target: { value: 'public-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '완전히 삭제하기' }));

    expect(await screen.findByRole('button', { name: '삭제 중…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '영구 삭제 닫기' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
