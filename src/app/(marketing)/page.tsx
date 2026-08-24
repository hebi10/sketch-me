import Link from 'next/link';

const sampleDrawings = ['웃는 민수', '안경 쓴 지수', '모자 쓴 현우', '단발 수진'];

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
          <p className="eyebrow">친구들의 기억을 모으는 작은 책</p>
          <h1 id="landing-title">친구들은 나를 어떻게 그리고 있을까?</h1>
          <p>내 스캐치북을 만들고 친구들에게 그림을 받아보세요.</p>
          <Link className="button button--primary landing-cta" href="/create">
            내 스캐치북 만들기
          </Link>
          <p className="free-note">친구 그림 20개까지 무료</p>
        </div>

        <div className="drawing-stack" aria-label="친구들이 남긴 그림 예시">
          {sampleDrawings.map((drawing, index) => (
            <figure className={`sample-drawing sample-drawing--${index + 1}`} key={drawing}>
              <div aria-hidden="true" className="portrait-mark">
                <span>◜</span>
                <span>•‿•</span>
              </div>
              <figcaption>{drawing}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}
