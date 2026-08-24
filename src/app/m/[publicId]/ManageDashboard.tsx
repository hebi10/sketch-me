'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import type { Drawing } from '@/lib/domain/types';

interface ManageDashboardProps {
  publicId: string;
  name: string;
  participantCount: number;
  participantLimit: number;
  drawings: Drawing[];
}

export function ManageDashboard({ publicId, name, participantCount, participantLimit, drawings }: ManageDashboardProps) {
  const [limit, setLimit] = useState(participantLimit);
  const [message, setMessage] = useState<string | null>(null);
  const items = drawings.filter((drawing) => drawing.status !== 'DELETED');

  async function updateDrawing(drawingId: string, body: Record<string, unknown>) {
    setMessage(null);
    const response = await fetch(`/api/manage/${publicId}/drawings/${drawingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { message?: string };
      setMessage(result.message ?? '변경하지 못했습니다.');
      return;
    }
    window.location.reload();
  }

  async function deleteDrawing(drawingId: string) {
    if (!window.confirm('이 그림을 삭제할까요? 삭제하면 되돌릴 수 없습니다.')) return;
    const response = await fetch(`/api/manage/${publicId}/drawings/${drawingId}`, { method: 'DELETE' });
    if (!response.ok) {
      setMessage('그림을 삭제하지 못했습니다.');
      return;
    }
    window.location.reload();
  }

  async function purchase() {
    const response = await fetch(`/api/manage/${publicId}/purchase`, { method: 'POST' });
    const result = await response.json() as { participantLimit?: number; message?: string };
    if (!response.ok || !result.participantLimit) {
      setMessage(result.message ?? '결제를 처리하지 못했습니다.');
      return;
    }
    setLimit(result.participantLimit);
    setMessage('모의 결제가 완료되어 친구 그림 20개가 추가됐어요.');
  }

  return (
    <main className="manage-shell">
      <header className="public-header">
        <Link className="wordmark" href="/">스캐치북</Link>
        <Link href={`/s/${publicId}`}>친구 페이지 보기</Link>
      </header>
      <section className="manage-heading"><p className="eyebrow">내 스캐치북</p><h1>{name}님의 그림 모음</h1></section>
      <section className="manage-summary">
        <p>친구 그림 <strong>{participantCount}</strong> / {limit}</p>
        <progress max={limit} value={participantCount} />
        <button className="button button--secondary" onClick={purchase} type="button">+20명 추가 · 990원</button>
      </section>
      {message ? <p className="submission-success" role="status">{message}</p> : null}
      <div className="manage-actions">
        <Link className="button button--secondary" href={`/s/${publicId}`}>친구에게 공유하기</Link>
        <Link className="button button--primary" href={`/m/${publicId}/share`}>스토리 이미지 만들기</Link>
      </div>
      <section className="manage-drawings">
        <h2>친구들이 그린 나</h2>
        <div className="friend-drawing-grid">
          {items.length ? items.map((drawing) => (
            <article className="friend-drawing-card manage-drawing-card" key={drawing.id}>
              <div className="manage-drawing-image">
                {drawing.bestRank ? <span className="best-badge">BEST {drawing.bestRank}</span> : null}
                <Image alt={`${drawing.authorName}님의 그림`} height={340} src={`/api/manage/${publicId}/drawings/${drawing.id}/image`} unoptimized width={255} />
              </div>
              <p>{drawing.authorName}</p>
              {drawing.message ? <span>{drawing.message}</span> : null}
              <span className="drawing-status">{drawing.status === 'VISIBLE' ? '공개 중' : '숨김'}</span>
              <details className="drawing-actions">
                <summary>그림 관리</summary>
                <div className="drawing-action-panel">
                  <button onClick={() => updateDrawing(drawing.id, { action: drawing.status === 'VISIBLE' ? 'hide' : 'show' })} type="button">
                    {drawing.status === 'VISIBLE' ? '친구 페이지에서 숨기기' : '친구 페이지에 공개하기'}
                  </button>
                  <div className="best-actions" aria-label="BEST 순위 지정">
                    {[1, 2, 3, 4].map((rank) => (
                      <button aria-pressed={drawing.bestRank === rank} disabled={drawing.status !== 'VISIBLE'} key={rank} onClick={() => updateDrawing(drawing.id, { action: 'best', bestRank: rank })} type="button">{rank}</button>
                    ))}
                  </div>
                  {drawing.bestRank ? <button onClick={() => updateDrawing(drawing.id, { action: 'clearBest' })} type="button">BEST 해제</button> : null}
                  <button className="danger-action" onClick={() => deleteDrawing(drawing.id)} type="button">그림 삭제</button>
                </div>
              </details>
            </article>
          )) : <p className="empty-drawings">아직 친구가 남긴 그림이 없어요.</p>}
        </div>
      </section>
    </main>
  );
}
