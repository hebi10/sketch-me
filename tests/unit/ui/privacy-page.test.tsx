import { render, screen } from '@testing-library/react';

import PrivacyPage from '@/app/privacy/page';

describe('PrivacyPage', () => {
  it('처리 항목과 보유 기간, Firebase 처리 위치를 공개한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByRole('heading', { name: '개인정보 처리방침' })).toBeVisible();
    expect(screen.getByText('시행일: 2026년 10월 2일')).toBeVisible();
    expect(screen.getByRole('heading', { name: '처리하는 개인정보' })).toBeVisible();
    expect(screen.getByText(/이름 또는 애칭, 관리용 비밀번호의 일방향 해시/)).toBeVisible();
    expect(screen.getByText(/무료 스케치북은 생성일로부터 6개월/)).toBeVisible();
    expect(screen.getByRole('heading', { name: '처리위탁 및 국외 이전' })).toBeVisible();
    expect(screen.getByText(/Cloud Firestore.*대한민국 서울/)).toBeVisible();
    expect(screen.getByText(/Cloud Storage.*미국 사우스캐롤라이나.*us-east1/)).toBeVisible();
    expect(screen.getByText(/Firebase App Hosting.*대만/)).toBeVisible();
    expect(screen.queryByText(/참고 사진/)).not.toBeInTheDocument();
  });

  it('72시간 생성 제한 해시와 무료 스케치북 삭제 기준을 안내한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/IP 원문은 저장하지 않고.*복원하기 어려운 해시.*최대 72시간/)).toBeVisible();
    expect(screen.getByText(/무료 스케치북의 Firestore 기록과 Storage 파일을 자동 삭제/)).toBeVisible();
    expect(screen.queryByText(/대금결제/)).not.toBeInTheDocument();
  });

  it('제3자 제공 원칙과 권리 행사 연락처를 안내한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByRole('heading', { name: '개인정보의 제3자 제공 및 처리위탁' })).toBeVisible();
    expect(screen.getByText(/개인정보를 제3자에게 제공하지 않습니다/)).toBeVisible();
    expect(screen.getByRole('heading', { name: '이용자의 권리와 행사 방법' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'asdlkj0104@gmail.com' })).toHaveAttribute('href', 'mailto:asdlkj0104@gmail.com');
  });

  it('관리 PIN은 브라우저 저장소에 남기지 않고 현재 페이지 메모리에서만 처리함을 안내한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/입력한 관리용 비밀번호 원문은 서버에 저장하지 않습니다/)).toBeVisible();
    expect(screen.getByText(/현재 페이지 메모리에서만 처리하며.*새로고침하거나 탭을 닫으면 사라집니다/)).toBeVisible();
    expect(screen.getByText(/이름, 비밀번호 힌트와 직접 그린 그림 초안만 sessionStorage/)).toBeVisible();
    expect(screen.queryByText(/이름, 관리용 비밀번호, 힌트.*sessionStorage/)).not.toBeInTheDocument();
  });

  it('이메일 문의는 처리 목적이 끝나면 삭제한다고 안내한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/일반 문의는 처리 목적 달성 후 지체 없이 삭제/)).toBeVisible();
  });

  it('무료 참여 인원 운영 목적을 안내한다', () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/무료 참여 인원 50명 운영과 서비스 문의 처리/)).toBeVisible();
    expect(screen.queryByText(/결제용 휴대전화번호/)).not.toBeInTheDocument();
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

  it('결제 동의 기록을 처리하지 않는다', () => {
    render(<PrivacyPage />);

    expect(screen.queryByText(/동의 시각과 동의 문구 버전/)).not.toBeInTheDocument();
  });
});
