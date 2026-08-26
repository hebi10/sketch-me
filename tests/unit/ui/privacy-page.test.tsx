import { render, screen } from '@testing-library/react';

import PrivacyPage from '@/app/privacy/page';

describe('PrivacyPage', () => {
  it('관리 PIN이 생성 중 브라우저 세션 초안에만 임시 저장됨을 안내한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/입력한 관리 비밀번호 원문은 서버에 저장하지 않습니다/)).toBeVisible();
    expect(screen.getByText(/생성 중에는 브라우저의 sessionStorage 초안에 임시 저장되며, 생성에 성공하거나 탭 또는 브라우저 세션이 끝나면 사라집니다/)).toBeVisible();
  });
});
