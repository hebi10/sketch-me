import { fireEvent, render, screen } from '@testing-library/react';

import { StoryImageComposer } from '@/app/m/[publicId]/share/StoryImageComposer';

describe('StoryImageComposer', () => {
  it('updates the preview background when a user selects a different design', () => {
    render(<StoryImageComposer drawings={[]} name="도영" publicUrl="/s/book-1" />);

    const preview = screen.getByLabelText('스토리 이미지 미리보기');
    expect(preview).toHaveStyle({ backgroundImage: 'url(/story/sketchbook-share-background.webp)' });

    const skySketch = screen.getByRole('button', { name: '푸른 하늘' });
    fireEvent.click(skySketch);

    expect(skySketch).toHaveAttribute('aria-pressed', 'true');
    expect(preview).toHaveStyle({ backgroundImage: 'url(/story/story-theme-sky-sketch.webp)' });
  });
});
