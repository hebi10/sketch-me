import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StoryImageMaker, type StoryDrawing } from './StoryImageMaker';
import { storyStyle } from '@/lib/share/story-style';
import { getManagedSketchbook } from '@/lib/sketchbooks/management';
import { listDrawings } from '@/lib/sketchbooks/repository';

export const dynamic = 'force-dynamic';

export default async function SharePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) notFound();

  const drawings = await listDrawings(sketchbook.id);
  const publicPath = `/s/${publicId}`;
  const bestDrawings = drawings
    .filter((drawing) => drawing.status === 'VISIBLE' && drawing.bestRank)
    .map((drawing) => ({
      rank: drawing.bestRank as 1 | 2 | 3 | 4,
      imageUrl: `/api/manage/${publicId}/drawings/${drawing.id}/image`,
    }))
    .sort((a, b) => a.rank - b.rank) satisfies StoryDrawing[];

  return (
    <main className="share-shell">
      <header className="simple-header share-header">
        <Link aria-label="내 스캐치북으로 돌아가기" className="header-icon-link" href={`/m/${publicId}`}>←</Link>
        <span className="header-title">스토리 이미지</span>
        <span aria-hidden="true" className="header-balance" />
      </header>
      <section
        aria-label="스토리 이미지 미리보기"
        className="story-preview"
        style={{
          backgroundColor: storyStyle.background,
          backgroundImage: `url(${storyStyle.backgroundImage})`,
        }}
      >
        <p>친구들이 그린 나</p>
        <h1>{sketchbook.name} BEST 4</h1>
        <div className="story-best-grid">
          {[1, 2, 3, 4].map((rank) => {
            const drawing = bestDrawings.find((item) => item.rank === rank);
            return (
              <figure className={`story-best-slot story-best-slot--${rank}`} key={rank}>
                <b>BEST {rank}</b>
                {drawing ? <Image alt={`BEST ${rank} 그림`} fill sizes={rank === 1 ? '420px' : '140px'} src={drawing.imageUrl} unoptimized /> : <span>아직 선정 전</span>}
              </figure>
            );
          })}
        </div>
        <div className="story-preview-cta">
          <strong>나도 스케치북에 그림 남기기</strong>
          <span>{publicPath}</span>
        </div>
      </section>
      <p className="story-output-meta">1080 × 1440 · 3:4 공유 이미지</p>
      <StoryImageMaker drawings={bestDrawings} name={sketchbook.name} publicUrl={publicPath} />
    </main>
  );
}
