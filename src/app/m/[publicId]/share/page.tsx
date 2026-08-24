import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StoryImageMaker, type StoryDrawing } from './StoryImageMaker';
import { getManagedSketchbook } from '@/lib/sketchbooks/management';
import { listDrawings } from '@/lib/sketchbooks/repository';

export const dynamic = 'force-dynamic';

export default async function SharePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) notFound();

  const drawings = await listDrawings(sketchbook.id);
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
      <section className="story-preview">
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
        <span>1080 × 1920 스토리 이미지</span>
      </section>
      <StoryImageMaker drawings={bestDrawings} name={sketchbook.name} publicUrl={`/s/${publicId}`} />
    </main>
  );
}
