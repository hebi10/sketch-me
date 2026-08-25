import { fireEvent, render, screen } from '@testing-library/react';

import { HeaderMenu } from '@/components/ui/HeaderMenu';

describe('HeaderMenu', () => {
  it('텍스트 메뉴를 표시하고 항목 선택 후 닫는다', () => {
    render(
      <HeaderMenu>
        <a href="/manage">내 스케치북 관리</a>
        <button type="button">로그아웃</button>
      </HeaderMenu>,
    );

    const menu = screen.getByLabelText('메뉴');
    expect(menu).toHaveTextContent('☰');
    expect(menu).not.toHaveTextContent('메뉴');
    fireEvent.click(menu);
    expect(screen.getByRole('link', { name: '내 스케치북 관리' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    expect(menu.closest('details')).not.toHaveAttribute('open');
  });
});
