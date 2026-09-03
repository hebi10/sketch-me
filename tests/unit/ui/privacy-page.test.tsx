import { render, screen } from '@testing-library/react';

import PrivacyPage from '@/app/privacy/page';

describe('PrivacyPage', () => {
  it('처리 항목과 보유 기간, Firebase 처리 위치를 공개한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByRole('heading', { name: '개인정보 처리방침' })).toBeVisible();
    expect(screen.getByText('시행일: 2026년 8월 26일')).toBeVisible();
    expect(screen.getByRole('heading', { name: '처리하는 개인정보' })).toBeVisible();
    expect(screen.getByText(/이름 또는 애칭, 관리용 비밀번호의 일방향 해시/)).toBeVisible();
    expect(screen.getByText(/스케치북을 삭제할 때까지/)).toBeVisible();
    expect(screen.getByRole('heading', { name: '처리위탁 및 국외 이전' })).toBeVisible();
    expect(screen.getByText(/Cloud Firestore.*대한민국 서울/)).toBeVisible();
    expect(screen.getByText(/Cloud Storage.*미국 버지니아/)).toBeVisible();
    expect(screen.getByText(/Firebase App Hosting.*대만/)).toBeVisible();
    expect(screen.queryByText(/참고 사진/)).not.toBeInTheDocument();
  });

  it('제3자 제공 여부와 권리 행사 연락처를 안내한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByRole('heading', { name: '개인정보의 제3자 제공' })).toBeVisible();
    expect(screen.getByText(/제3자에게 제공하지 않습니다/)).toBeVisible();
    expect(screen.getByRole('heading', { name: '이용자의 권리와 행사 방법' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'asdlkj0104@gmail.com' })).toHaveAttribute('href', 'mailto:asdlkj0104@gmail.com');
  });

  it('관리 PIN이 생성 중 브라우저 세션 초안에만 임시 저장됨을 안내한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/입력한 관리용 비밀번호 원문은 서버에 저장하지 않습니다/)).toBeVisible();
    expect(screen.getByText(/생성 중에는 브라우저의 sessionStorage 초안에 임시 저장되며, 생성에 성공하거나 탭 또는 브라우저 세션이 끝나면 사라집니다/)).toBeVisible();
  });

  it('결제 기록과 결제수단 정보의 저장 범위를 안내한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/결제에 따른 참여 가능 인원·워터마크 제거 권한과 구매 기록 관리/)).toBeVisible();
    expect(screen.getByText(/카드번호 등 결제수단 정보는 직접 저장하지 않습니다/)).toBeVisible();
    expect(screen.queryByText(/모의 결제/)).not.toBeInTheDocument();
  });

  it('갤러리 썸네일과 공개 캐시, 직접 삭제 동작을 안내한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/갤러리용 320px WebP 썸네일을 별도로 생성/)).toBeVisible();
    expect(screen.getByText(/공개 갤러리의 썸네일은.*최대 약 5분간.*캐시/)).toBeVisible();
    expect(screen.getByText(/숨김·삭제하면 새 공개 버전으로 바뀌거나 접근이 차단/)).toBeVisible();
    expect(screen.getByText(/관리 화면에서 전체 삭제를 요청하면 먼저 공개 접근을 막고/)).toBeVisible();
  });
});
