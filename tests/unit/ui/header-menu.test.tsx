import { fireEvent, render, screen, within } from '@testing-library/react';

import { HeaderMenu } from '@/components/ui/HeaderMenu';
import LandingPage from '@/app/(marketing)/page';

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

describe('랜딩 페이지 빠른 메뉴', () => {
  it('세 메뉴를 이미지 없이 짧은 한글 문구로 표시한다', () => {
    render(<LandingPage />);
    const menu = screen.getByRole('navigation', { name: '빠른 메뉴 항목' });

    const items = [
      ['스케치북 만들기', '제작'],
      ['개인정보 처리방침', '개인정보'],
      ['서비스 이용 및 결제 안내', '이용안내'],
    ] as const;

    items.forEach(([name, shortLabel]) => {
      const link = within(menu).getByRole('link', { name });
      expect(link).toHaveTextContent(shortLabel);
    });
    expect(menu.querySelector('img')).not.toBeInTheDocument();
  });
});
