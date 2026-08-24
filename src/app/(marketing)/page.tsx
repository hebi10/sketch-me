import Image from 'next/image';
import Link from 'next/link';

import { BrandWordmark } from '@/components/ui/BrandWordmark';

export default function LandingPage() {
  return (
    <main className="marketing-shell">
      <header className="marketing-header">
        <BrandWordmark />
        <details className="header-menu">
          <summary aria-label="메뉴 열기">☰</summary>
          <nav aria-label="빠른 메뉴">
            <Link href="/create">스케치북 만들기</Link>
            <Link href="/privacy">개인정보 처리 안내</Link>
          </nav>
        </details>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="eyebrow">친구들이 그린 나를 모으는 스케치북</p>
          <h1 id="landing-title">친구들은<br />나를 어떻게<br />그리고 있을까?</h1>
          <p>내 스캐치북을 만들고 친구들에게 그림을 받아보세요.</p>
        </div>

        <figure className="landing-collage">
          <Image
            alt="친구들이 연필로 그린 네 장의 초상화 카드"
            height={1400}
            preload
            src="/brand/landing-sketch-collage.webp"
            width={1120}
          />
        </figure>

        <div className="landing-action">
          <Link className="button button--primary landing-cta" href="/create">
            내 스캐치북 만들기
          </Link>
          <p className="free-note">친구 그림 20개까지 무료</p>
        </div>
      </section>
      <footer className="marketing-footer"><Link href="/privacy">개인정보 처리 안내</Link></footer>
    </main>
  );
}
