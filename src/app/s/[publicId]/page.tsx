import Image from 'next/image';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { findSketchbookByPublicId, findVisibleBestDrawing, listVisibleDrawings } from '@/lib/sketchbooks/repository';
import { resolveLinkShareThumbnail } from '@/lib/share/link-thumbnail';
import { FREE_PARTICIPANT_LIMIT, isSketchbookFull } from '@/lib/sketchbooks/capacity';
import { formatTimeAgo } from '@/lib/time/time-ago';
import { galleryImageLoading } from '@/lib/images/loading';
import { ModerationBlockedNotice } from './ModerationBlockedNotice';
import { PublicSketchbookHeader } from './PublicSketchbookHeader';
import styles from './PublicOwnerDrawing.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const sketchbook = await findSketchbookByPublicId(publicId);
  if (!sketchbook || sketchbook.status !== 'PUBLIC') {
    return { title: '페이지를 찾을 수 없어요' };
  }
  if (sketchbook.moderationStatus === 'BLOCKED') {
    return {
      robots: { follow: false, index: false },
      title: '이용이 제한된 스케치북',
    };
  }

  const title = `${sketchbook.name}의 스케치북`;
  const description = `${sketchbook.name}님을 기억나는 모습대로 그려주세요.`;
  const bestDrawing = sketchbook.shareThumbnailMode === 'BEST_1'
    ? await findVisibleBestDrawing(sketchbook.id, 1)
    : null;
  const shareThumbnail = resolveLinkShareThumbnail(sketchbook, bestDrawing);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{
        url: shareThumbnail.url,
        width: shareThumbnail.width,
        height: shareThumbnail.height,
        alt: shareThumbnail.alt,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [shareThumbnail.url],
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
  if (sketchbook.moderationStatus === 'BLOCKED') return <ModerationBlockedNotice />;

  const drawings = (await listVisibleDrawings(sketchbook.id))
    .filter((drawing) => drawing.moderationStatus === 'ACTIVE');
  const bestDrawings = drawings
    .filter((drawing) => drawing.bestRank)
    .sort((left, right) => (left.bestRank ?? 5) - (right.bestRank ?? 5));
  const friendDrawings = drawings.filter((drawing) => drawing.bestRank == null);
  const bestRanks = [1, 2, 3, 4] as const;
  const rankedDrawings = bestRanks.reduce<
    Array<{ drawing: (typeof bestDrawings)[number] | null; owner: boolean; rank: (typeof bestRanks)[number] }>
  >(
    (acc, rank) => {
      if (sketchbook.ownerDrawingPath && sketchbook.ownerBestRank === rank) {
        acc.push({ drawing: null, owner: true, rank });
        return acc;
      }
      const drawing = bestDrawings.find((item) => item.bestRank === rank);
      if (drawing) acc.push({ drawing, owner: false, rank });
      return acc;
    },
    [],
  );
  const isFull = isSketchbookFull(sketchbook);
  const hasDrawings = drawings.length > 0;

  return (
    <main className="public-sketchbook-shell">
      <PublicSketchbookHeader name={sketchbook.name} publicId={publicId} />

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

      {sketchbook.ownerDrawingPath ? (
        <section className={styles.section} aria-labelledby="owner-drawing-heading">
          <div className="section-title-row">
            <h2 id="owner-drawing-heading">내가 그린 나</h2>
            <span>OWNER</span>
          </div>
          <div className={styles.image}>
            <Image
              alt={`${sketchbook.name}님이 직접 그린 모습`}
              height={720}
              loading="eager"
              src={`/api/sketchbooks/${publicId}/owner/image`}
              unoptimized
              width={720}
            />
          </div>
        </section>
      ) : null}

      {rankedDrawings.length > 0 ? (
        <section className="public-feed-section" aria-labelledby="best-drawings-heading">
            <div className="section-title-row"><h2 id="best-drawings-heading">♕ 베스트 그림</h2><span>BEST 4</span></div>
            <div className="best-drawing-grid">
              {rankedDrawings.map(({ drawing, owner, rank }) => {
                if (owner) {
                  return (
                    <article className="best-drawing-card" key={rank}>
                      <div className="best-drawing-image">
                        <b>BEST {rank}</b>
                        <Image alt={`BEST ${rank}, ${sketchbook.name}님의 그림`} height={255} src={`/api/sketchbooks/${publicId}/owner/image`} unoptimized width={255} />
                      </div>
                      <p>{`${sketchbook.name} (내 그림)`}</p>
                    </article>
                  );
                }
                if (!drawing) return null;
                return (
                  <article className="best-drawing-card" key={rank}>
                    <div className="best-drawing-image">
                      <b>BEST {rank}</b>
                      <Image alt={`BEST ${rank}, ${drawing.authorName}님의 그림`} height={255} src={`/api/sketchbooks/${publicId}/drawings/${drawing.id}/thumbnail?v=${encodeURIComponent(drawing.publicImageVersion)}`} unoptimized width={255} />
                    </div>
                    <p>{drawing.authorName}</p>
                  </article>
                );
              })}
            </div>
        </section>
      ) : null}

      {hasDrawings ? (
        <section className="friend-board" aria-labelledby="friend-drawings-heading">
          <div className="section-title-row">
            <h2 className="public-section-title" id="friend-drawings-heading">친구들이 그린 나</h2>
            <span>{sketchbook.participantCount} / {sketchbook.participantLimit}</span>
          </div>
          {friendDrawings.length > 0 ? (
            <div className="friend-drawing-grid">
              {friendDrawings.map((drawing, index) => (
                <article className="friend-drawing-card" key={drawing.id}>
                  <Image alt={`${drawing.authorName}님의 그림`} height={255} loading={galleryImageLoading(index)} src={`/api/sketchbooks/${publicId}/drawings/${drawing.id}/thumbnail?v=${encodeURIComponent(drawing.publicImageVersion)}`} unoptimized width={255} />
                  <div className="drawing-card-meta"><p>{drawing.authorName}</p><span>{formatTimeAgo(drawing.createdAt)}</span></div>
                </article>
              ))}
            </div>
          ) : null}
          {isFull ? <span aria-disabled="true" className="button button--disabled board-draw-button">친구 그림 접수 마감</span> : <Link className="button button--primary board-draw-button" href={`/s/${publicId}/draw`}>✎ 그림 남기기</Link>}
          <div className="board-progress"><span>기본 {FREE_PARTICIPANT_LIMIT}개 무료</span><strong>{sketchbook.participantCount} / {sketchbook.participantLimit}</strong></div>
        </section>
      ) : (
        <section className="public-empty-state" aria-labelledby="first-drawing-title">
          <h2 id="first-drawing-title">첫 그림을 남겨주세요</h2>
          <p>이 스케치북의 첫 장을 열어 주세요. 기억나는 모습 그대로면 충분해요.</p>
          {isFull ? <span aria-disabled="true" className="button button--disabled">친구 그림 접수 마감</span> : <Link className="button button--primary" href={`/s/${publicId}/draw`}>첫 그림 남기기</Link>}
          <div className="public-empty-create">
            <p>나도 친구들에게 그림을 받아보고 싶다면 ↓</p>
            <Link className="button button--secondary" href="/create">내 스케치북 만들기</Link>
          </div>
        </section>
      )}

    </main>
  );
}
