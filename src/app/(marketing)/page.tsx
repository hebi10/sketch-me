import Image from 'next/image';
import Link from 'next/link';

import { BrandWordmark } from '@/components/ui/BrandWordmark';
import { HeaderMenu } from '@/components/ui/HeaderMenu';

export default function LandingPage() {
  return (
    <main className="marketing-shell">
      <header className="marketing-header">
        <BrandWordmark />
        <HeaderMenu iconGrid label="빠른 메뉴">
          <Link aria-label="스케치북 만들기" className="header-menu-icon-item" href="/create" title="스케치북 만들기">
            <Image alt="" aria-hidden height={160} src="/icons/menu-create.webp" width={160} />
          </Link>
          <Link aria-label="개인정보 처리방침" className="header-menu-icon-item" href="/privacy" title="개인정보 처리방침">
            <Image alt="" aria-hidden height={160} src="/icons/menu-privacy.webp" width={160} />
          </Link>
          <Link aria-label="서비스 이용 및 결제 안내" className="header-menu-icon-item" href="/terms" title="서비스 이용 및 결제 안내">
            <Image alt="" aria-hidden height={160} src="/icons/menu-terms.webp" width={160} />
          </Link>
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
        </div>
      </section>
      <footer className="marketing-footer">
        <Link href="/privacy">개인정보 처리방침</Link>
        <Link href="/terms">서비스 이용 및 결제 안내</Link>
      </footer>
    </main>
  );
}
