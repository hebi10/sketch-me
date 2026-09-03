import type { Metadata } from 'next';
import Link from 'next/link';

import { BrandWordmark } from '@/components/ui/BrandWordmark';

export const metadata: Metadata = {
  title: '서비스 이용 및 결제 안내 | 스캐치북',
  description: '스캐치북의 서비스 이용, 결제, 유료 상품 보장 및 서비스 종료 정책입니다.',
};

export default function TermsPage() {
  return (
    <main className="legal-shell">
      <header className="simple-header">
        <span aria-hidden="true" className="header-balance" />
        <BrandWordmark />
        <span aria-hidden="true" className="header-balance" />
      </header>
      <article className="legal-document">
        <header className="legal-intro">
          <p className="eyebrow">서비스 정책</p>
          <h1>서비스 이용 및 결제 안내</h1>
          <p>스캐치북을 안심하고 이용할 수 있도록 무료 이용 범위와 결제·서비스 종료 기준을 안내합니다.</p>
          <p className="legal-effective-date">시행일: 2026년 8월 27일</p>
        </header>

        <nav aria-label="서비스 정책 목차" className="legal-toc">
          <a href="#service">서비스 이용</a>
          <a href="#payment">결제 안내</a>
          <a href="#guarantee">이용 보장</a>
          <a href="#closure">서비스 종료</a>
        </nav>

        <section id="service">
          <h2>1. 서비스 이용</h2>
          <p>스캐치북은 공개 링크를 받은 친구가 그림을 남기고, 스케치북 소유자가 그 결과를 관리하는 참여형 서비스입니다.</p>
          <ul>
            <li>스케치북 하나당 친구 그림 10개까지 무료로 받을 수 있습니다.</li>
            <li>공개 링크를 아는 사람은 별도 로그인 없이 친구 페이지를 열 수 있으므로 링크 관리에 주의해 주세요.</li>
            <li>소유자는 관리 화면에서 그림을 숨기거나 삭제하고 BEST 그림을 선택할 수 있습니다.</li>
          </ul>
        </section>

        <section id="payment">
          <h2>2. 결제 상품</h2>
          <ul>
            <li>친구 그림 10명 추가 · 990원</li>
            <li>친구 그림 50명 추가 · 4,490원</li>
            <li>친구 그림 100명 추가 · 8,490원</li>
            <li>결과 이미지 워터마크 제거 · 990원</li>
          </ul>
          <p><strong>결제가 완료되면 선택한 상품의 혜택이 즉시 적용됩니다.</strong> 결제 전 상품명과 금액을 확인해 주세요. 결제 완료 후에는 관리 화면과 스토리 이미지에서 적용된 혜택을 확인할 수 있습니다.</p>
        </section>

        <section id="guarantee">
          <h2>3. 구매 혜택과 이용 보장</h2>
          <p><strong>구매한 추가 인원과 워터마크 제거 권한은 서비스 운영 중 만료되지 않습니다.</strong> 구매일로부터 최소 1년간 서비스 이용을 보장합니다.</p>
          <p>추가 구매가 있으면 가장 최근 구매일을 기준으로 최소 보장 기간을 다시 계산합니다. 이미 받은 그림은 사용자가 직접 삭제하거나 정책 위반으로 제한되지 않는 한 서비스 운영 중 유지됩니다.</p>
        </section>

        <section id="closure">
          <h2>4. 서비스 종료와 환불</h2>
          <p><strong>구매일로부터 1년 안에 운영자 사유로 서비스를 종료하면 해당 구매 금액을 전액 환불합니다.</strong></p>
          <ul>
            <li>서비스 종료일 최소 30일 전에 사이트 공지 등 이용자가 확인할 수 있는 방법으로 안내합니다.</li>
            <li>종료 전 자신의 그림을 저장할 수 있는 기간과 방법을 함께 안내합니다.</li>
            <li>환불 대상을 확인한 날부터 3영업일 이내에 환불을 진행합니다.</li>
          </ul>
          <p>이용자가 직접 스케치북을 삭제했거나 이용정책을 위반해 제한된 경우에는 위 종료 보장이 적용되지 않을 수 있습니다. 관련 법령이 더 유리한 보호 기준을 정한 경우에는 그 기준을 우선 적용합니다.</p>
        </section>

        <section id="content">
          <h2>5. 이용자 콘텐츠와 운영 조치</h2>
          <p>그림과 메시지의 권리는 작성자에게 남습니다. 이용자는 서비스를 제공하기 위해 필요한 범위에서 해당 콘텐츠를 저장·표시하고 스토리 이미지로 생성하는 것을 허용합니다.</p>
          <p>타인의 권리를 침해하거나 불법·유해한 콘텐츠를 올려서는 안 됩니다. 신고 또는 운영상 확인이 필요한 경우 콘텐츠를 임시 숨김하거나 삭제할 수 있습니다.</p>
        </section>

        <section id="changes">
          <h2>6. 정책 변경과 문의</h2>
          <p>정책을 변경하면 시행 10일 전에 안내하고, 이용자에게 불리한 중요한 변경은 시행 30일 전에 안내합니다. 법령상 즉시 반영이 필요한 경우에는 적용 후 지체 없이 알릴 수 있습니다.</p>
          <p>서비스 및 결제 정책 문의: <a href="mailto:asdlkj0104@gmail.com">asdlkj0104@gmail.com</a></p>
        </section>

        <nav aria-label="관련 페이지" className="legal-page-links">
          <Link href="/privacy">개인정보 처리방침</Link>
          <Link href="/">홈으로 돌아가기</Link>
        </nav>
      </article>
    </main>
  );
}
