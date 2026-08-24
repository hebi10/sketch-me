import Link from 'next/link';

import { BrandWordmark } from '@/components/ui/BrandWordmark';

export default function PrivacyPage() {
  return (
    <main className="legal-shell">
      <header className="simple-header">
        <span aria-hidden="true" className="header-balance" />
        <BrandWordmark />
        <span aria-hidden="true" className="header-balance" />
      </header>
      <article>
        <p className="eyebrow">개인정보 처리 안내</p>
        <h1>그림과 사진을 이렇게 다뤄요</h1>
        <section><h2>저장하는 정보</h2><p>스케치북 이름, 본인 그림, 선택한 참고 사진, 친구가 남긴 이름·그림·한마디를 저장합니다.</p></section>
        <section><h2>사용 목적과 공개 범위</h2><p>친구가 공개 링크에서 그림을 남기고 결과를 함께 보기 위해서만 사용합니다. 참고 사진은 그림을 그리는 화면에서만 제공됩니다.</p></section>
        <section><h2>보관과 삭제</h2><p>스케치북을 운영하는 동안 보관합니다. 관리 화면의 ‘스케치북 전체 삭제’를 누르면 관련 사진, 그림과 기록을 영구 삭제합니다.</p></section>
        <section><h2>관리 링크 보호</h2><p>관리 복구 링크를 가진 사람은 그림 공개 여부와 삭제를 변경할 수 있으므로 다른 사람에게 전달하지 마세요.</p></section>
      </article>
      <Link className="button button--secondary" href="/">홈으로 돌아가기</Link>
    </main>
  );
}
