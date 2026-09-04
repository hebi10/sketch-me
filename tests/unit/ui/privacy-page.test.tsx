import { render, screen } from '@testing-library/react';

import PrivacyPage from '@/app/privacy/page';

describe('PrivacyPage', () => {
  it('처리 항목과 보유 기간, Firebase 처리 위치를 공개한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByRole('heading', { name: '개인정보 처리방침' })).toBeVisible();
    expect(screen.getByText('시행일: 2026년 9월 4일')).toBeVisible();
    expect(screen.getByRole('heading', { name: '처리하는 개인정보' })).toBeVisible();
    expect(screen.getByText(/이름 또는 애칭, 관리용 비밀번호의 일방향 해시/)).toBeVisible();
    expect(screen.getByText(/무료 스케치북은 생성일로부터 6개월/)).toBeVisible();
    expect(screen.getByRole('heading', { name: '처리위탁 및 국외 이전' })).toBeVisible();
    expect(screen.getByText(/Cloud Firestore.*대한민국 서울/)).toBeVisible();
    expect(screen.getByText(/Cloud Storage.*미국 버지니아/)).toBeVisible();
    expect(screen.getByText(/Firebase App Hosting.*대만/)).toBeVisible();
    expect(screen.queryByText(/참고 사진/)).not.toBeInTheDocument();
  });

  it('72시간 생성 제한 해시와 콘텐츠·거래 기록의 분리 보관을 안내한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/IP 원문은 저장하지 않고.*복원하기 어려운 해시.*최대 72시간/)).toBeVisible();
    expect(screen.getByText(/계약.*대금결제.*5년/)).toBeVisible();
    expect(screen.getByText(/무료 스케치북의 Firestore 기록과 Storage 파일을 자동 삭제/)).toBeVisible();
    expect(screen.getByText(/스케치북을 삭제하더라도 법정 거래 기록은 별도 저장소에 분리/)).toBeVisible();
    expect(screen.getByText(/보존기간이 끝나면 지체 없이 파기/)).toBeVisible();
  });

  it('결제 처리위탁과 권리 행사 연락처를 안내한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByRole('heading', { name: '개인정보의 제3자 제공 및 처리위탁' })).toBeVisible();
    expect(screen.getByText("주식회사 유디아이디(페이앱)")).toBeVisible();
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
    expect(screen.getAllByText(/결제용 휴대전화번호/).length).toBeGreaterThan(0);
    expect(screen.getByText(/끝 4자리만 저장/)).toBeVisible();
    expect(screen.queryByText(/모의 결제/)).not.toBeInTheDocument();
  });

  it('갤러리 썸네일과 공개 캐시, 직접 삭제 동작을 안내한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/갤러리용 320px WebP 썸네일을 별도로 생성/)).toBeVisible();
    expect(screen.getByText(/공개 갤러리의 썸네일은.*최대 약 5분간.*캐시/)).toBeVisible();
    expect(screen.getByText(/숨김·삭제하면 새 공개 버전으로 바뀌거나 접근이 차단/)).toBeVisible();
    expect(screen.getByText(/관리 화면에서 전체 삭제를 요청하면 먼저 공개 접근을 막고/)).toBeVisible();
  });

  it('개인정보 처리자와 고충처리 연락처를 식별할 수 있게 공개한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/개인정보처리자: 해비/)).toBeVisible();
    expect(screen.getByText(/대표자: 박도영/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'asdlkj0104@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:asdlkj0104@gmail.com',
    );
  });

  it('디지털 혜택 제공 동의 기록의 처리 항목을 안내한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/동의 시각과 동의 문구 버전/)).toBeVisible();
  });
});
