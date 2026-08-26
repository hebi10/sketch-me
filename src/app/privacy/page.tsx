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
        <section><h2>저장하는 정보</h2><p>스케치북 이름, 본인 그림, 선택한 참고 사진, 친구가 남긴 이름·그림·한마디를 저장합니다. 관리를 위해 비밀번호의 일방향 해시, 선택한 비밀번호 힌트와 관리 세션 정보도 저장합니다. 입력한 관리 비밀번호 원문은 저장하지 않습니다.</p></section>
        <section><h2>사용 목적과 공개 범위</h2><p>친구가 공개 링크에서 그림을 남기고 결과를 함께 보기 위해서만 사용합니다. 참고 사진은 그림을 그리는 화면에서만 제공됩니다.</p></section>
        <section><h2>보관과 삭제</h2><p>스케치북을 운영하는 동안 보관합니다. 관리 화면에서 전체 삭제를 시작하면 먼저 공개 접근을 막은 뒤 관련 사진, 그림과 기록을 영구 삭제합니다. 삭제 도중 일시적으로 실패하면 같은 관리 세션에서 다시 시도할 수 있습니다.</p></section>
        <section><h2>관리 비밀번호 보호</h2><p>관리 비밀번호는 복구할 수 없습니다. 다른 사람이 추측하기 어려운 숫자 4자리를 사용하고 공유하지 마세요. 관리가 끝난 공용 기기에서는 브라우저 세션을 정리해 주세요.</p></section>
        <section><h2>자동 보안 확인</h2><p>운영자가 Firebase App Check를 활성화한 환경에서는 자동화된 남용을 줄이기 위해 공개 생성·제출 요청의 보안 확인 토큰을 처리합니다. 이 기능은 사용자를 식별하는 프로필 정보로 사용하지 않습니다.</p></section>
      </article>
      <Link className="button button--secondary" href="/">홈으로 돌아가기</Link>
    </main>
  );
}
