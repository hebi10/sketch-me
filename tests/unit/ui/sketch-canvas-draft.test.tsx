import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { SketchCanvas } from '@/app/s/[publicId]/draw/SketchCanvas';

const navigation = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));

const draftKey = 'sketch-me:drawing-draft:public-1:v1';

describe('SketchCanvas 친구 그림 초안', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,drawing');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      beginPath: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(),
      lineTo: vi.fn(), moveTo: vi.fn(), stroke: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
    } as unknown as CanvasRenderingContext2D);
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      set src(_value: string) { this.onload?.(); }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('확인 전 완료한 획과 이름·한마디를 재마운트 후 복구하고 다시 편집한다', async () => {
    const view = render(<SketchCanvas publicId="public-1" sketchbookName="해비" />);
    fireEvent.change(screen.getByLabelText('내 이름'), { target: { value: '친구' } });
    fireEvent.change(screen.getByLabelText(/한마디/), { target: { value: '반가워요' } });
    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    const canvas = screen.getByLabelText('해비님을 위한 그림 캔버스');
    Object.defineProperty(canvas, 'setPointerCapture', { value: vi.fn() });
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 100, left: 0, top: 0 } as DOMRect);
    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });

    await waitFor(() => expect(JSON.parse(sessionStorage.getItem(draftKey) ?? '{}')).toEqual({
      version: 1, authorName: '친구', message: '반가워요', imageDataUrl: 'data:image/png;base64,drawing',
    }));
    view.unmount();
    render(<SketchCanvas publicId="public-1" sketchbookName="해비" />);

    await waitFor(() => expect(screen.getByLabelText('내 이름')).toHaveValue('친구'));
    expect(screen.getByLabelText(/한마디/)).toHaveValue('반가워요');
    expect(await screen.findByRole('img', { name: '그린 그림 미리보기' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '그림 수정하기' }));
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(screen.getByRole('button', { name: '그림 수정하기' })).toHaveFocus();
  });

  it('다른 스캐치북의 초안을 섞지 않는다', async () => {
    sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, authorName: '첫 친구', message: '첫 초안' }));
    render(<SketchCanvas publicId="public-2" sketchbookName="다른 친구" />);
    await waitFor(() => expect(sessionStorage.getItem('sketch-me:drawing-draft:public-2:v1')).not.toBeNull());
    expect(screen.getByLabelText('내 이름')).toHaveValue('');
    expect(screen.getByLabelText(/한마디/)).toHaveValue('');
    expect(JSON.parse(sessionStorage.getItem(draftKey) ?? '{}')).toMatchObject({ authorName: '첫 친구' });
  });

  it('같은 화면에서 publicId가 바뀌어도 이전 초안을 새 스캐치북에 복사하지 않는다', async () => {
    sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, authorName: '첫 친구', message: '첫 초안' }));
    const view = render(<SketchCanvas publicId="public-1" sketchbookName="해비" />);
    await waitFor(() => expect(screen.getByLabelText('내 이름')).toHaveValue('첫 친구'));

    view.rerender(<SketchCanvas publicId="public-2" sketchbookName="다른 친구" />);
    await waitFor(() => expect(sessionStorage.getItem('sketch-me:drawing-draft:public-2:v1')).not.toBeNull());
    expect(screen.getByLabelText('내 이름')).toHaveValue('');
    expect(JSON.parse(sessionStorage.getItem(draftKey) ?? '{}')).toMatchObject({ authorName: '첫 친구' });
  });

  it('복구한 그림을 제출하고 성공한 초안만 삭제한다', async () => {
    sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, authorName: '친구', message: '반가워요', imageDataUrl: 'data:image/png;base64,drawing' }));
    render(<SketchCanvas publicId="public-1" sketchbookName="해비" />);
    await screen.findByRole('img', { name: '그린 그림 미리보기' });
    fireEvent.click(screen.getByRole('button', { name: '그림 남기기' }));

    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/s/public-1?submitted=1'));
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)).toEqual({ authorName: '친구', message: '반가워요', imageDataUrl: 'data:image/png;base64,drawing' });
    expect(sessionStorage.getItem(draftKey)).toBeNull();
  });

  it('제출이 실패하면 초안과 입력을 유지한다', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ message: '다시 시도해 주세요' }) } as Response);
    sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, authorName: '친구', imageDataUrl: 'data:image/png;base64,drawing' }));
    render(<SketchCanvas publicId="public-1" sketchbookName="해비" />);
    await screen.findByRole('img', { name: '그린 그림 미리보기' });
    fireEvent.click(screen.getByRole('button', { name: '그림 남기기' }));

    expect(await screen.findByText('다시 시도해 주세요')).toBeVisible();
    expect(JSON.parse(sessionStorage.getItem(draftKey) ?? '{}')).toMatchObject({ authorName: '친구', imageDataUrl: 'data:image/png;base64,drawing' });
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('저장소 읽기·쓰기·삭제가 모두 실패해도 그린 그림을 제출한다', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('unavailable'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('unavailable'); });
    render(<SketchCanvas publicId="public-1" sketchbookName="해비" />);
    fireEvent.change(screen.getByLabelText('내 이름'), { target: { value: '친구' } });
    fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    fireEvent.click(screen.getByRole('button', { name: '그림 남기기' }));

    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/s/public-1?submitted=1'));
  });
});
