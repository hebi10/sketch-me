import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { CreateSketchbookForm } from '@/app/create/CreateSketchbookForm';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const draftKey = 'sketch-me:create-draft:v1';

describe('CreateSketchbookForm 생성 초안과 PIN 검사', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('신규 스케치북의 무료 그림 한도를 10개로 안내한다', async () => {
    render(<CreateSketchbookForm />);

    expect(await screen.findByText('친구 그림 10개까지 무료로 받아볼 수 있어요.')).toBeVisible();
  });

  it('스케치북 생성 흐름에서 참고 사진 입력을 표시하지 않는다', async () => {
    render(<CreateSketchbookForm />);

    await waitFor(() => expect(sessionStorage.getItem(draftKey)).not.toBeNull());

    expect(screen.queryByRole('heading', { name: '참고 사진' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('사진 선택하기')).not.toBeInTheDocument();
    expect(screen.getByText('그리지 않아도 스캐치북을 만들 수 있어요.')).toBeVisible();
  });

  it('세션 초안의 이름, PIN, 힌트를 복원한다', async () => {
    sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, name: '해비', managePin: '1234', managePinHint: '좋아하는 숫자' }));
    render(<CreateSketchbookForm />);

    await waitFor(() => expect(screen.getByLabelText('이름 또는 애칭')).toHaveValue('해비'));
    expect(screen.getByLabelText('관리용 비밀번호')).toHaveValue('1234');
    expect(screen.getByLabelText(/비밀번호 힌트/)).toHaveValue('좋아하는 숫자');
  });

  it('숫자 네 자리가 아닌 PIN에는 제품 안내 문구를 표시한다', async () => {
    render(<CreateSketchbookForm />);

    fireEvent.invalid(screen.getByLabelText('관리용 비밀번호'));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('관리용 비밀번호는 숫자 4자리로 입력해 주세요.'));
  });

  it('생성에 성공하면 세션 초안을 지운다', async () => {
    sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, name: '해비', managePin: '1234', managePinHint: '좋아하는 숫자' }));
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ manageUrl: '/m/abc', publicUrl: '/s/abc' }),
      ok: true,
    } as Response);
    render(<CreateSketchbookForm />);
    fireEvent.change(screen.getByLabelText('이름 또는 애칭'), { target: { value: '해비' } });
    fireEvent.change(screen.getByLabelText('관리용 비밀번호'), { target: { value: '1234' } });

    fireEvent.click(screen.getByRole('button', { name: '내 스캐치북 만들기' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: '스캐치북이 완성됐어요' })).toBeVisible());
    expect(sessionStorage.getItem(draftKey)).toBeNull();
  });

  it('초안 읽기에 실패해도 스케치북을 생성한다', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('저장소를 읽을 수 없습니다.');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('저장소에서 삭제할 수 없습니다.');
    });
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ manageUrl: '/m/abc', publicUrl: '/s/abc' }),
      ok: true,
    } as Response);

    render(<CreateSketchbookForm />);
    fireEvent.change(screen.getByLabelText('이름 또는 애칭'), { target: { value: '해비' } });
    fireEvent.change(screen.getByLabelText('관리용 비밀번호'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: '내 스캐치북 만들기' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: '스캐치북이 완성됐어요' })).toBeVisible());
  });

  it('초안 저장 공간이 부족해도 스케치북을 생성한다', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('저장 공간이 부족합니다.', 'QuotaExceededError');
    });
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ manageUrl: '/m/abc', publicUrl: '/s/abc' }),
      ok: true,
    } as Response);

    render(<CreateSketchbookForm />);
    fireEvent.change(screen.getByLabelText('이름 또는 애칭'), { target: { value: '해비' } });
    fireEvent.change(screen.getByLabelText('관리용 비밀번호'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: '내 스캐치북 만들기' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: '스캐치북이 완성됐어요' })).toBeVisible());
  });

  it('초안 저장에 실패해도 스케치북을 생성한다', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('저장소에 쓸 수 없습니다.');
    });
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ manageUrl: '/m/abc', publicUrl: '/s/abc' }),
      ok: true,
    } as Response);

    render(<CreateSketchbookForm />);
    fireEvent.change(screen.getByLabelText('이름 또는 애칭'), { target: { value: '해비' } });
    fireEvent.change(screen.getByLabelText('관리용 비밀번호'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: '내 스캐치북 만들기' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: '스캐치북이 완성됐어요' })).toBeVisible());
  });

  it('초안 삭제에 실패해도 스케치북을 생성한다', async () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('저장소에서 삭제할 수 없습니다.');
    });
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ manageUrl: '/m/abc', publicUrl: '/s/abc' }),
      ok: true,
    } as Response);

    render(<CreateSketchbookForm />);
    fireEvent.change(screen.getByLabelText('이름 또는 애칭'), { target: { value: '해비' } });
    fireEvent.change(screen.getByLabelText('관리용 비밀번호'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: '내 스캐치북 만들기' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: '스캐치북이 완성됐어요' })).toBeVisible());
  });
});
