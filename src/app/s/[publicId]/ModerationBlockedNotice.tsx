import Link from 'next/link';

export function ModerationBlockedNotice() {
  return (
    <main className="state-shell">
      <p className="eyebrow">이용 제한</p>
      <h1>현재 이용할 수 없는 스케치북이에요</h1>
      <p>운영자 확인이 끝난 뒤 다시 이용해 주세요.</p>
      <Link className="button button--primary" href="/">홈으로 돌아가기</Link>
    </main>
  );
}
