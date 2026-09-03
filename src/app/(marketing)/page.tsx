import Image from 'next/image';
import Link from 'next/link';

import { BrandWordmark } from '@/components/ui/BrandWordmark';
import { BusinessDisclosure } from '@/components/ui/BusinessDisclosure';
import { HeaderMenu } from '@/components/ui/HeaderMenu';

export default function LandingPage() {
  return (
    <main className="marketing-shell">
      <header className="marketing-header">
        <BrandWordmark />
        <HeaderMenu label="빠른 메뉴">
          <Link aria-label="스케치북 만들기" href="/create" title="스케치북 만들기">제작</Link>
          <Link aria-label="개인정보 처리방침" href="/privacy" title="개인정보 처리방침">개인정보</Link>
          <Link aria-label="서비스 이용 및 결제 안내" href="/terms" title="서비스 이용 및 결제 안내">이용안내</Link>
        </HeaderMenu>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="eyebrow">내 이미지 스케치북</p>
          <h1 id="landing-title">친구들이 보는 내 모습은?</h1>
          <p>내 스캐치북을 채울 수 있게 친구들에게 공유해보세요.</p>
        </div>

        <figure className="landing-collage">
          <Image
            alt="친구들이 손으로 그린 네 장의 초상화 카드"
            height={1374}
            preload
            src="/brand/landing-sketch-collage-v2.png"
            width={1145}
          />
        </figure>

        <div className="landing-action">
          <Link className="button button--primary landing-cta" href="/create">
            내 스캐치북 만들기
          </Link>
        </div>
      </section>
      <footer className="marketing-footer">
        <nav aria-label="정책 안내" className="marketing-footer-links">
          <Link href="/privacy">개인정보 처리방침</Link>
          <Link href="/terms">서비스 이용 및 결제 안내</Link>
        </nav>
        <BusinessDisclosure compact />
      </footer>
    </main>
  );
}
