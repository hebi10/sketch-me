import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StoryImageComposer } from './StoryImageComposer';
import type { StoryDrawing } from './StoryImageMaker';
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
      <StoryImageComposer drawings={bestDrawings} name={sketchbook.name} publicUrl={publicPath} />
    </main>
  );
}
