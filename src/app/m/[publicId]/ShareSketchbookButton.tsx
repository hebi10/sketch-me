'use client';

import { useState } from 'react';

export function ShareSketchbookButton({ publicId, name, menuItem = false }: { publicId: string; name: string; menuItem?: boolean }) {
  const [status, setStatus] = useState<string | null>(null);

  async function share() {
    const url = `${window.location.origin}/s/${publicId}`;
    setStatus(null);
    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: `${name}의 스캐치북 도착!`,
            text: `${name}님을 기억나는 모습대로 그려주세요.`,
            url,
          });
          setStatus('공유창을 열었어요.');
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          await navigator.clipboard.writeText(url);
          setStatus('공유창을 열지 못해 링크를 복사했어요.');
        }
      } else {
        await navigator.clipboard.writeText(url);
        setStatus('링크를 복사했어요.');
      }
    } catch {
      setStatus('공유하지 못했어요. 링크를 다시 복사해 주세요.');
    }
  }

  if (menuItem) {
    return (
      <button aria-label="공유하기" onClick={share} title="공유하기" type="button">공유</button>
    );
  }

  return (
    <div className="share-action-stack">
      <button className="button button--secondary" onClick={share} type="button">공유하기</button>
      {status ? <p aria-live="polite" role="status">{status}</p> : null}
    </div>
  );
}
