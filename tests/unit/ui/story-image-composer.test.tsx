import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { StoryImageComposer } from '@/app/m/[publicId]/share/StoryImageComposer';

describe('StoryImageComposer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the shared heading as an app text layer above BEST 4', () => {
    render(<StoryImageComposer drawings={[]} initialWatermarkFree={false} name="내 이름" publicId="book-1" publicUrl="/s/book-1" />);

    const preview = screen.getByLabelText('스토리 이미지 미리보기');
    expect(screen.getByText('친구들이 그린 내 모습')).toBeInTheDocument();
    expect(preview).toHaveTextContent('BEST 4');
    expect(screen.getByRole('img', { name: '스캐치북 워터마크' })).toBeVisible();
    expect(screen.getByRole('button', { name: '워터마크 없이 저장하기 · 990원' })).toBeVisible();
  });

  it('updates the preview background when a user selects a different design', () => {
    render(<StoryImageComposer drawings={[]} initialWatermarkFree name="내 이름" publicId="book-1" publicUrl="/s/book-1" />);

    const preview = screen.getByLabelText('스토리 이미지 미리보기');
    expect(preview).toHaveStyle({ backgroundImage: 'url(/story/sketchbook-share-background.webp)' });

    const skySketch = screen.getByRole('button', { name: '푸른 하늘' });
    fireEvent.click(skySketch);

    expect(skySketch).toHaveAttribute('aria-pressed', 'true');
    expect(preview).toHaveStyle({ backgroundImage: 'url(/story/story-theme-sky-sketch.webp)' });
    expect(screen.queryByRole('img', { name: '스캐치북 워터마크' })).not.toBeInTheDocument();
    expect(screen.getByText('워터마크 제거가 적용되어 있어요.')).toBeVisible();
  });

  it('입력한 제목을 미리보기에 즉시 반영하고 저장한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ storyHeading: '우리들의 소중한 추억' }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <StoryImageComposer
        drawings={[]}
        initialHeading="친구들이 그린 내 모습"
        initialWatermarkFree
        name="내 이름"
        publicId="book-1"
        publicUrl="/s/book-1"
      />,
    );

    const input = screen.getByRole('textbox', { name: '이미지 제목' });
    fireEvent.change(input, { target: { value: '우리들의 소중한 추억' } });

    expect(screen.getByLabelText('스토리 이미지 미리보기')).toHaveTextContent('우리들의 소중한 추억');
    expect(screen.getByText('11/30')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '제목 저장하기' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/manage/book-1/sketchbook', {
      body: JSON.stringify({ storyHeading: '우리들의 소중한 추억' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    }));
    expect(await screen.findByText('제목을 저장했어요.')).toBeVisible();
  });

  it('워터마크 결제 완료 팝업을 확인한 뒤 구매 혜택을 적용한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ entitlements: { watermarkFree: true }, participantLimit: 20 }),
      ok: true,
    }));
    render(
      <StoryImageComposer
        drawings={[]}
        initialWatermarkFree={false}
        name="내 이름"
        publicId="book-1"
        publicUrl="/s/book-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '워터마크 없이 저장하기 · 990원' }));

    const successDialog = await screen.findByRole('dialog', { name: '결제 완료' });
    expect(screen.getByRole('img', { name: '스캐치북 워터마크' })).toBeVisible();
    fireEvent.click(successDialog.querySelector('button')!);

    expect(await screen.findByText('워터마크 제거가 적용되어 있어요.')).toBeVisible();
    expect(screen.queryByRole('img', { name: '스캐치북 워터마크' })).not.toBeInTheDocument();
  });
});
