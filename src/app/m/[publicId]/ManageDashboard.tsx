'use client';

import { useState } from 'react';
import Link from 'next/link';

import type { Drawing } from '@/lib/domain/types';

export function ManageDashboard({ publicId, name, participantCount, participantLimit, drawings }: { publicId: string; name: string; participantCount: number; participantLimit: number; drawings: Drawing[] }) {
  const [limit, setLimit] = useState(participantLimit);
  const items = drawings;
  const [message, setMessage] = useState<string | null>(null);

  async function updateDrawing(drawingId: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/manage/${publicId}/drawings/${drawingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) { setMessage('변경하지 못했습니다.'); return; }
    window.location.reload();
  }

  async function purchase() {
    const response = await fetch(`/api/manage/${publicId}/purchase`, { method: 'POST' });
    const result = await response.json() as { participantLimit?: number; message?: string };
    if (!response.ok || !result.participantLimit) { setMessage(result.message ?? '결제를 처리하지 못했습니다.'); return; }
    setLimit(result.participantLimit);
    setMessage('모의 결제가 완료되어 친구 그림 20개가 추가됐어요.');
  }

  return <main className="manage-shell">
    <header className="public-header"><Link className="wordmark" href="/">스캐치북</Link><Link href={`/s/${publicId}`}>친구 페이지 보기</Link></header>
    <section className="manage-heading"><p className="eyebrow">내 스캐치북</p><h1>{name}님의 그림 모음</h1></section>
    <section className="manage-summary"><p>친구 그림 <strong>{participantCount}</strong> / {limit}</p><progress max={limit} value={participantCount} /><button className="button button--secondary" onClick={purchase} type="button">+20명 추가 · 990원</button></section>
    {message ? <p className="submission-success" role="status">{message}</p> : null}
    <div className="manage-actions"><Link className="button button--secondary" href={`/s/${publicId}`}>친구에게 공유하기</Link><Link className="button button--primary" href={`/m/${publicId}/share`}>스토리 이미지 만들기</Link></div>
    <section className="manage-drawings"><h2>친구들이 그린 나</h2><div className="friend-drawing-grid">{items.map((drawing) => <article className="friend-drawing-card" key={drawing.id}><div className="drawing-placeholder">그림</div><p>{drawing.authorName} {drawing.bestRank ? `· BEST ${drawing.bestRank}` : ''}</p><div className="card-actions"><button onClick={() => updateDrawing(drawing.id, { action: drawing.status === 'VISIBLE' ? 'hide' : 'show' })} type="button">{drawing.status === 'VISIBLE' ? '숨기기' : '보이기'}</button>{[1,2,3,4].map((rank) => <button key={rank} onClick={() => updateDrawing(drawing.id, { action: 'best', bestRank: rank })} type="button">BEST {rank}</button>)}</div></article>)}</div></section>
  </main>;
}
