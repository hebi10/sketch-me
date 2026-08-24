'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="state-shell">
      <p className="eyebrow">잠시 문제가 생겼어요</p>
      <h1>페이지를 불러오지 못했어요</h1>
      <p>잠시 후 다시 시도해 주세요.</p>
      <div className="state-actions">
        <button className="button button--primary" onClick={reset} type="button">다시 시도하기</button>
        <Link className="button button--secondary" href="/">홈으로 가기</Link>
      </div>
    </main>
  );
}
