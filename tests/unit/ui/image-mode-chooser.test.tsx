import { fireEvent, render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { vi } from 'vitest';

import { ImageModeChooser } from '@/app/m/[publicId]/share/ImageModeChooser';

describe('ImageModeChooser', () => {
  it('한 장과 BEST 이미지 제작 링크를 제공한다', () => {
    const onClose = vi.fn();
    render(<ImageModeChooser onClose={onClose} open publicId="book-1" />);

    const dialog = screen.getByRole('dialog', { name: '이미지 제작 방식 선택' });
    expect(within(dialog).getByRole('link', { name: /그림 하나 제작하기/ }))
      .toHaveAttribute('href', '/m/book-1/share?mode=single');
    expect(within(dialog).getByRole('link', { name: /BEST 이미지 제작하기/ }))
      .toHaveAttribute('href', '/m/book-1/share?mode=best');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('닫은 뒤 실행 버튼으로 포커스를 되돌린다', () => {
    const triggerRef = createRef<HTMLButtonElement>();
    const onClose = vi.fn();
    const { rerender } = render(
      <>
        <button ref={triggerRef} type="button">이미지 제작</button>
        <ImageModeChooser onClose={onClose} open publicId="book-1" triggerRef={triggerRef} />
      </>,
    );

    expect(screen.getByRole('link', { name: /그림 하나 제작하기/ })).toHaveFocus();
    rerender(
      <>
        <button ref={triggerRef} type="button">이미지 제작</button>
        <ImageModeChooser onClose={onClose} open={false} publicId="book-1" triggerRef={triggerRef} />
      </>,
    );
    expect(screen.getByRole('button', { name: '이미지 제작' })).toHaveFocus();
  });

  it('직접 접근에서는 닫기 링크를 관리 화면으로 연결한다', () => {
    render(<ImageModeChooser dismissHref="/m/book-1" open publicId="book-1" />);

    expect(screen.getByRole('link', { name: '이미지 제작 방식 선택 닫기' }))
      .toHaveAttribute('href', '/m/book-1');
  });
});
