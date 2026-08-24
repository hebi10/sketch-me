import Image from 'next/image';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { findSketchbookByPublicId, listVisibleDrawings } from '@/lib/sketchbooks/repository';
import { isSketchbookFull } from '@/lib/sketchbooks/capacity';
import { formatTimeAgo } from '@/lib/time/time-ago';
import { galleryImageLoading } from '@/lib/images/loading';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const sketchbook = await findSketchbookByPublicId(publicId);
  if (!sketchbook || sketchbook.status !== 'PUBLIC') return { title: '페이지를 찾을 수 없어요' };

  const title = `${sketchbook.name}의 스케치북`;
  const description = `${sketchbook.name}님을 기억나는 모습대로 그려주세요.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{
        url: `/api/sketchbooks/${publicId}/owner/image`,
        width: 720,
        height: 960,
        alt: `${sketchbook.name}님의 스케치`,
      }],
    },
  };
}

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
  const bestDrawings = drawings
    .filter((drawing) => drawing.bestRank)
    .sort((left, right) => (left.bestRank ?? 5) - (right.bestRank ?? 5));
  const recentDrawing = drawings[0];
  const isFull = isSketchbookFull(sketchbook);

  return (
    <main className="public-sketchbook-shell">
      <header className="public-header">
        <Link aria-label="스캐치북 홈" className="header-icon-link" href="/">←</Link>
        <span className="header-title">{sketchbook.name}의 스캐치북</span>
        {isFull ? <span className="header-draw-link is-disabled">마감</span> : <Link aria-label="친구 스케치 하기" className="header-draw-link" href={`/s/${publicId}/draw`}>✎</Link>}
      </header>

      <section className="public-intro" aria-labelledby="public-title">
        <h1 id="public-title">{sketchbook.name}의 스케치북</h1>
        <h2 className="intro-invitation">{sketchbook.name}님을 그려주세요</h2>
        <p>기억나는 모습, 성격, 분위기 모두 좋아요.</p>
        <p className="participant-copy">♧ 친구 <strong>{sketchbook.participantCount}명</strong>이 그림을 남겼어요.</p>
      </section>

      {submitted ? (
        <div className="post-submit-action" role="status">
          <p>그림을 남겼어요. 고마워요!</p>
          <Link className="button button--secondary" href="/create">내 스케치북 만들기</Link>
        </div>
      ) : null}

      <section className="friend-board" aria-labelledby="friend-drawings-heading">
        <div className="section-title-row">
          <h2 className="public-section-title" id="friend-drawings-heading">친구들이 그린 나</h2>
          <span>{sketchbook.participantCount} / {sketchbook.participantLimit}</span>
        </div>
        <div className="friend-drawing-grid">
        {drawings.length ? drawings.map((drawing, index) => (
          <article className="friend-drawing-card" key={drawing.id}>
            <Image alt={`${drawing.authorName}님의 그림`} height={340} loading={galleryImageLoading(index)} src={`/api/sketchbooks/${publicId}/drawings/${drawing.id}/image`} width={255} />
            <div className="drawing-card-meta"><p>{drawing.authorName}</p><span>{formatTimeAgo(drawing.createdAt)}</span></div>
          </article>
        )) : <p className="empty-drawings">아직 첫 번째 그림을 기다리고 있어요.</p>}
        </div>
        {isFull ? <span aria-disabled="true" className="button button--disabled board-draw-button">친구 그림 접수 마감</span> : <Link className="button button--primary board-draw-button" href={`/s/${publicId}/draw`}>✎ 그림 남기기</Link>}
        <div className="board-progress"><span>친구 그림 {sketchbook.participantLimit}개까지 무료</span><strong>{sketchbook.participantCount} / {sketchbook.participantLimit}</strong></div>
      </section>

      <section className="public-feed-section" aria-labelledby="best-drawings-heading">
        <div className="section-title-row"><h2 id="best-drawings-heading">♕ 베스트 그림</h2><span>BEST 4</span></div>
        <div className="best-drawing-grid">
          {[1, 2, 3, 4].map((rank) => {
            const drawing = bestDrawings.find((item) => item.bestRank === rank);
            return (
              <article className="best-drawing-card" key={rank}>
                <div className="best-drawing-image">
                  <b>BEST {rank}</b>
                  {drawing ? <Image alt={`BEST ${rank}, ${drawing.authorName}님의 그림`} height={340} src={`/api/sketchbooks/${publicId}/drawings/${drawing.id}/image`} width={255} /> : <span>선정 전</span>}
                </div>
                <p>{drawing?.authorName ?? '기다리는 중'}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="public-feed-section recent-section" aria-labelledby="recent-drawing-heading">
        <div className="section-title-row"><h2 id="recent-drawing-heading">◷ 최근 올라온 그림</h2></div>
        {recentDrawing ? (
          <article className="recent-drawing-card">
            <Image alt={`${recentDrawing.authorName}님의 최근 그림`} height={120} src={`/api/sketchbooks/${publicId}/drawings/${recentDrawing.id}/image`} width={90} />
            <div><strong>{recentDrawing.authorName}</strong><span>{formatTimeAgo(recentDrawing.createdAt)}</span>{recentDrawing.message ? <p>{recentDrawing.message}</p> : null}</div>
          </article>
        ) : <p className="empty-drawings">첫 그림을 남겨주세요.</p>}
        <p className="kind-comment">✎ 따뜻한 말 한마디가 큰 힘이 돼요. 서로 존중하는 댓글을 남겨주세요!</p>
      </section>

    </main>
  );
}
