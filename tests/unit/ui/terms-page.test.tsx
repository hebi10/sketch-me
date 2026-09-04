import { render, screen } from '@testing-library/react';

import LandingPage from '@/app/(marketing)/page';
import TermsPage, { metadata } from '@/app/terms/page';

describe('TermsPage', () => {
  it('루트 제목 템플릿에 서비스명을 한 번만 붙일 수 있도록 페이지 제목만 제공한다', () => {
    expect(metadata.title).toBe('서비스 이용 및 결제 안내');
  });

  it('추가 인원과 1년 서비스 보장 조건을 안내한다', () => {
    render(<TermsPage />);

    expect(screen.getByRole('heading', { name: '서비스 이용 및 결제 안내' })).toBeVisible();
    expect(screen.getByText(/구매한 추가 인원과 워터마크 제거 권한은 서비스 운영 중 만료되지 않습니다/)).toBeVisible();
    expect(screen.getByText(/구매일로부터 최소 1년간 서비스 이용을 보장/)).toBeVisible();
    expect(screen.getByText(/무료 스케치북은 생성일로부터 6개월간 보관/)).toBeVisible();
    expect(screen.getByText(/자동 삭제 예정일은 관리 화면에서 안내/)).toBeVisible();
    expect(screen.getByText(/1년 안에 운영자 사유로 서비스를 종료하면 해당 구매 금액을 전액 환불/)).toBeVisible();
  });

  it('서비스 종료 공지와 환불 기한, 결제 완료 혜택을 안내한다', () => {
    render(<TermsPage />);

    expect(screen.getByText(/종료일 최소 30일 전/)).toBeVisible();
    expect(screen.getByText(/청약철회를 접수한 날부터 3영업일 이내/)).toBeVisible();
    expect(screen.getByRole('heading', { name: '2. 결제 상품' })).toBeVisible();
    expect(screen.getByText(/페이앱의 검증된 결제 완료 통보를 서버가 확인한 뒤/)).toBeVisible();
    expect(screen.getByText(/전체 취소 또는 환불/)).toBeVisible();
    expect(screen.getByText(/결제 완료와 동시에 선택한 디지털 혜택의 제공이 시작/)).toBeVisible();
    expect(screen.getByText(/표시·광고 또는 계약 내용과 다르게 제공된 경우/)).toBeVisible();
    expect(screen.queryByText(/모의 결제/)).not.toBeInTheDocument();
  });

  it('청약철회와 디지털 콘텐츠·미성년자 보호 기준을 구체적으로 안내한다', () => {
    render(<TermsPage />);

    expect(screen.getByText(/계약내용에 관한 서면을 받은 날.*7일 이내/)).toBeVisible();
    expect(screen.getByText(/친구 그림 10개까지 무료로 이용/)).toBeVisible();
    expect(screen.getByText(/워터마크가 표시된 결과 이미지를 미리 확인/)).toBeVisible();
    expect(screen.getByText(/결제수단의 취소 제한은 판매자의 법정 환불 의무를 없애지 않습니다/)).toBeVisible();
    expect(screen.getByText(/법정대리인이 동의하지 않은 미성년자 계약/)).toBeVisible();
    expect(screen.getByRole('link', { name: '청약철회·환불 신청 이메일' }))
      .toHaveAttribute('href', expect.stringContaining('mailto:asdlkj0104@gmail.com'));
  });

  it('현재 인원 추가 가격과 워터마크 제거 상품을 정확히 안내한다', () => {
    render(<TermsPage />);

    expect(screen.getByText('스케치북 하나당 친구 그림 10개까지 무료로 받을 수 있습니다.')).toBeVisible();
    expect(screen.getByText('친구 그림 10명 추가 · 1,000원')).toBeVisible();
    expect(screen.getByText('친구 그림 50명 추가 · 4,490원')).toBeVisible();
    expect(screen.getByText('친구 그림 100명 추가 · 8,490원')).toBeVisible();
    expect(screen.getByText('결과 이미지 워터마크 제거 · 1,000원')).toBeVisible();
  });

  it('랜딩에서 개인정보와 이용·결제 정책으로 이동할 수 있다', () => {
    render(<LandingPage />);

    expect(screen.getAllByRole('link', { name: '개인정보 처리방침' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: '서비스 이용 및 결제 안내' }).some((link) => link.getAttribute('href') === '/terms')).toBe(true);
  });

  it('사업자등록증으로 확인한 판매자 정보를 공개하고 불필요한 개인정보는 제외한다', () => {
    const { container } = render(<TermsPage />);

    expect(screen.getByRole('heading', { name: '6. 판매자 정보' })).toBeVisible();
    expect(screen.getByText('해비')).toBeVisible();
    expect(screen.getByText('박도영')).toBeVisible();
    expect(screen.getByText('432-13-02831')).toBeVisible();
    expect(screen.getByText(/서울특별시 광진구/)).toBeVisible();
    expect(container).not.toHaveTextContent('생년월일');
  });

  it('랜딩 초기 화면에서 판매자 정보와 사업자등록번호를 확인할 수 있다', () => {
    render(<LandingPage />);

    expect(screen.getByText(/상호 해비/)).toBeVisible();
    expect(screen.getByText(/사업자등록번호 432-13-02831/)).toBeVisible();
    expect(screen.getByText(/도매 및 소매업 · 전자상거래 소매업/)).toBeVisible();
  });
});
