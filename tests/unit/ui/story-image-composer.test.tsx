import { fireEvent, render, screen } from '@testing-library/react';

import { StoryImageComposer } from '@/app/m/[publicId]/share/StoryImageComposer';

describe('StoryImageComposer', () => {
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
});
