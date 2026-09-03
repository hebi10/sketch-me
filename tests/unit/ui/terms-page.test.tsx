import { render, screen } from '@testing-library/react';

import LandingPage from '@/app/(marketing)/page';
import TermsPage from '@/app/terms/page';

describe('TermsPage', () => {
  it('추가 인원과 1년 서비스 보장 조건을 안내한다', () => {
    render(<TermsPage />);

    expect(screen.getByRole('heading', { name: '서비스 이용 및 결제 안내' })).toBeVisible();
    expect(screen.getByText(/구매한 추가 인원과 워터마크 제거 권한은 서비스 운영 중 만료되지 않습니다/)).toBeVisible();
    expect(screen.getByText(/구매일로부터 최소 1년간 서비스 이용을 보장/)).toBeVisible();
    expect(screen.getByText(/1년 안에 운영자 사유로 서비스를 종료하면 해당 구매 금액을 전액 환불/)).toBeVisible();
  });

  it('서비스 종료 공지와 환불 기한, 결제 완료 혜택을 안내한다', () => {
    render(<TermsPage />);

    expect(screen.getByText(/종료일 최소 30일 전/)).toBeVisible();
    expect(screen.getByText(/환불 대상을 확인한 날부터 3영업일 이내/)).toBeVisible();
    expect(screen.getByRole('heading', { name: '2. 결제 상품' })).toBeVisible();
    expect(screen.getByText(/결제가 완료되면 선택한 상품의 혜택이 즉시 적용/)).toBeVisible();
    expect(screen.queryByText(/모의 결제/)).not.toBeInTheDocument();
  });

  it('현재 인원 추가 가격과 워터마크 제거 상품을 정확히 안내한다', () => {
    render(<TermsPage />);

    expect(screen.getByText('스케치북 하나당 친구 그림 10개까지 무료로 받을 수 있습니다.')).toBeVisible();
    expect(screen.getByText('친구 그림 10명 추가 · 990원')).toBeVisible();
    expect(screen.getByText('친구 그림 50명 추가 · 4,490원')).toBeVisible();
    expect(screen.getByText('친구 그림 100명 추가 · 8,490원')).toBeVisible();
    expect(screen.getByText('결과 이미지 워터마크 제거 · 990원')).toBeVisible();
  });

  it('랜딩에서 개인정보와 이용·결제 정책으로 이동할 수 있다', () => {
    render(<LandingPage />);

    expect(screen.getAllByRole('link', { name: '개인정보 처리방침' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: '서비스 이용 및 결제 안내' }).some((link) => link.getAttribute('href') === '/terms')).toBe(true);
  });
});
