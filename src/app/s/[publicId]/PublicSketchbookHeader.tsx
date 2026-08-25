'use client';

import Link from 'next/link';
import { useState } from 'react';

import { HeaderMenu } from '@/components/ui/HeaderMenu';

export function PublicSketchbookHeader({ name, publicId }: { name: string; publicId: string }) {
  const [message, setMessage] = useState<string | null>(null);

  async function share() {
    const url = `${window.location.origin}/s/${publicId}`;
    const hasNativeShare = typeof (navigator as Navigator & { share?: unknown }).share === 'function';
    try {
      if (hasNativeShare) await navigator.share({ title: `${name}의 스케치북`, text: `${name}님을 그려주세요.`, url });
      else await navigator.clipboard.writeText(url);
      setMessage(hasNativeShare ? '공유창을 열었어요.' : '링크를 복사했어요.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(url);
        setMessage('링크를 복사했어요.');
      } catch {
        setMessage('공유하지 못했어요. 다시 시도해 주세요.');
      }
    }
  }

  return (
    <>
      <header className="public-header">
        <Link aria-label="스캐치북 홈" className="header-icon-link" href="/">←</Link>
        <span className="header-title">{name}의 스캐치북</span>
        <HeaderMenu>
          <Link href={`/m/${publicId}`}>내 스케치북 관리</Link>
          <button onClick={share} type="button">친구에게 공유하기</button>
          <Link href="/create">새 스케치북 만들기</Link>
        </HeaderMenu>
      </header>
      {message ? <p aria-live="polite" className="header-menu-status" role="status">{message}</p> : null}
    </>
  );
}
