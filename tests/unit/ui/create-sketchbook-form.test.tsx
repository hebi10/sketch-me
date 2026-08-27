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

  it('2MB가 넘는 참고 사진을 브라우저에서 WebP로 압축해 선택한다', async () => {
    const drawImage = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close: vi.fn(), height: 3000, width: 4000 })));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
      callback(new Blob(['compressed-reference'], { type }));
    });
    render(<CreateSketchbookForm />);
    const input = screen.getByLabelText('사진 선택하기');
    const largePhoto = new File([new Uint8Array(5 * 1024 * 1024)], 'phone-photo.jpg', { type: 'image/jpeg' });

    fireEvent.change(input, { target: { files: [largePhoto] } });

    await waitFor(() => expect(screen.getByText('다른 사진 선택')).toBeVisible());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('참고 사진을 압축하는 동안 선택과 제출을 잠근다', async () => {
    let finishDecode: ((bitmap: { close: () => void; height: number; width: number }) => void) | undefined;
    vi.stubGlobal('createImageBitmap', vi.fn(() => new Promise((resolve) => { finishDecode = resolve; })));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
      callback(new Blob(['compressed-reference'], { type }));
    });
    render(<CreateSketchbookForm />);
    const input = screen.getByLabelText('사진 선택하기');

    fireEvent.change(input, { target: { files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] } });

    expect(await screen.findByRole('status')).toHaveTextContent('사진 압축 중...');
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: '내 스캐치북 만들기' })).toBeDisabled();

    finishDecode?.({ close: vi.fn(), height: 900, width: 1200 });
    await waitFor(() => expect(screen.getByText('다른 사진 선택')).toBeVisible());
  });

  it('참고 사진을 WebP로 변환하지 못하면 다시 선택할 수 있게 안내한다', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close: vi.fn(), height: 900, width: 1200 })));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(null));
    render(<CreateSketchbookForm />);
    const input = screen.getByLabelText('사진 선택하기');

    fireEvent.change(input, { target: { files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] } });

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('사진을 압축하지 못했습니다. 다른 사진을 선택해 주세요.'));
    expect(input).toBeEnabled();
  });

  it('세션 초안의 이름, PIN, 힌트를 복원한다', async () => {
    sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, name: '해비', managePin: '1234', managePinHint: '좋아하는 숫자' }));
    render(<CreateSketchbookForm />);

    await waitFor(() => expect(screen.getByLabelText('이름 또는 애칭')).toHaveValue('해비'));
    expect(screen.getByLabelText('관리 비밀번호')).toHaveValue('1234');
    expect(screen.getByLabelText(/비밀번호 힌트/)).toHaveValue('좋아하는 숫자');
  });

  it('숫자 네 자리가 아닌 PIN에는 제품 안내 문구를 표시한다', async () => {
    render(<CreateSketchbookForm />);

    fireEvent.invalid(screen.getByLabelText('관리 비밀번호'));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('관리 비밀번호는 숫자 4자리로 입력해 주세요.'));
  });

  it('생성에 성공하면 세션 초안을 지운다', async () => {
    sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, name: '해비', managePin: '1234', managePinHint: '좋아하는 숫자' }));
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ manageUrl: '/m/abc', publicUrl: '/s/abc' }),
      ok: true,
    } as Response);
    render(<CreateSketchbookForm />);
    fireEvent.change(screen.getByLabelText('이름 또는 애칭'), { target: { value: '해비' } });
    fireEvent.change(screen.getByLabelText('관리 비밀번호'), { target: { value: '1234' } });

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
    fireEvent.change(screen.getByLabelText('관리 비밀번호'), { target: { value: '1234' } });
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
    fireEvent.change(screen.getByLabelText('관리 비밀번호'), { target: { value: '1234' } });
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
    fireEvent.change(screen.getByLabelText('관리 비밀번호'), { target: { value: '1234' } });
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
    fireEvent.change(screen.getByLabelText('관리 비밀번호'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: '내 스캐치북 만들기' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: '스캐치북이 완성됐어요' })).toBeVisible());
  });
});
