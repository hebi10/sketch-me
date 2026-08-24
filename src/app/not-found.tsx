import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="state-shell">
      <p className="eyebrow">404</p>
      <h1>페이지를 찾을 수 없어요</h1>
      <p>링크가 잘못되었거나 삭제된 스케치북일 수 있어요.</p>
      <Link className="button button--primary" href="/">홈으로 돌아가기</Link>
    </main>
  );
}
