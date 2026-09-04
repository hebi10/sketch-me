'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface CreateCompleteActionsProps {
  manageUrl: string;
  publicUrl: string;
}

export function CreateCompleteActions({ manageUrl, publicUrl }: CreateCompleteActionsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  async function share() {
    const url = new URL(publicUrl, window.location.origin).href;
    const canShare = typeof navigator.share === 'function';

    try {
      if (canShare) {
        await navigator.share({ title: '내 스캐치북', text: '친구들이 보는 내 모습을 그려주세요.', url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setStatus(canShare ? '공유창을 열었어요.' : '친구에게 보낼 링크를 복사했어요.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus('공유하지 못했어요. 다시 시도해 주세요.');
    }
  }

  return (
    <div className="create-complete-actions">
      <button className="button button--primary" onClick={share} type="button">친구에게 공유하기</button>
      <button className="button button--secondary" onClick={() => router.push(manageUrl)} type="button">내 스캐치북 관리하기</button>
      {status ? <p aria-live="polite" role="status">{status}</p> : null}
    </div>
  );
}
