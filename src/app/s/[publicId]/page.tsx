import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { findSketchbookByPublicId, listVisibleDrawings } from '@/lib/sketchbooks/repository';

export const dynamic = 'force-dynamic';

export default async function PublicSketchbookPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const [{ publicId }, { submitted }] = await Promise.all([params, searchParams]);
  const sketchbook = await findSketchbookByPublicId(publicId);

  if (!sketchbook || sketchbook.status !== 'PUBLIC') notFound();

  const drawings = await listVisibleDrawings(sketchbook.id);

  return (
    <main className="public-sketchbook-shell">
      <header className="public-header">
        <Link className="wordmark" href="/">스캐치북</Link>
        <span>공개 스케치북</span>
      </header>
      <section className="public-intro">
        <p className="eyebrow">{sketchbook.name}님의 스캐치북</p>
        <h1>{sketchbook.name}님을 그려주세요</h1>
        <p>기억나는 모습대로 자유롭게 그려주세요.</p>
        <p className="participant-copy">친구 {sketchbook.participantCount}명이 그림을 남겼어요.</p>
      </section>
      <section className="owner-sketch" aria-labelledby="owner-sketch-heading">
        <div><p className="eyebrow">내가 그린 나</p><h2 id="owner-sketch-heading">{sketchbook.name}님의 첫 스케치</h2></div>
        <Image alt={`${sketchbook.name}님이 직접 그린 모습`} height={640} priority src={`/api/sketchbooks/${publicId}/owner/image`} unoptimized width={480} />
      </section>
      {submitted ? <p className="submission-success" role="status">그림을 남겼어요. 고마워요!</p> : null}
      <section aria-labelledby="friend-drawings-heading">
        <h2 className="public-section-title" id="friend-drawings-heading">친구들이 그린 나</h2>
        <div className="friend-drawing-grid">
        {drawings.length ? drawings.map((drawing) => (
          <article className="friend-drawing-card" key={drawing.id}>
            <Image alt={`${drawing.authorName}님의 그림`} height={340} src={`/api/sketchbooks/${publicId}/drawings/${drawing.id}/image`} width={255} />
            <p>{drawing.authorName}</p>
            {drawing.message ? <span>{drawing.message}</span> : null}
          </article>
        )) : <p className="empty-drawings">아직 첫 번째 그림을 기다리고 있어요.</p>}
        </div>
      </section>
      <div className="sticky-draw-action">
        <Link className="button button--primary" href={`/s/${publicId}/draw`}>친구 스케치 하기</Link>
      </div>
    </main>
  );
}
