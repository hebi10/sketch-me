import Image from 'next/image';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="marketing-shell">
      <header className="marketing-header">
        <Link className="wordmark" href="/" aria-label="스캐치북 홈">
          스캐치북
        </Link>
        <span className="header-note">친구들이 그린 나를 모아보세요</span>
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
            priority
            src="/brand/landing-sketch-collage.png?v=2"
            unoptimized
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
    </main>
  );
}
