import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SketchCanvas } from './SketchCanvas';
import { findSketchbookByPublicId } from '@/lib/sketchbooks/repository';
import { isSketchbookFull } from '@/lib/sketchbooks/capacity';

export const dynamic = 'force-dynamic';

export default async function DrawFriendPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const sketchbook = await findSketchbookByPublicId(publicId);

  if (!sketchbook || sketchbook.status !== 'PUBLIC') notFound();

  if (isSketchbookFull(sketchbook)) {
    return (
      <main className="draw-shell capacity-shell">
        <p className="eyebrow">친구 그림 접수 마감</p>
        <h1>이 스케치북은 그림이 모두 찼어요</h1>
        <p>새 자리가 열리면 다시 참여할 수 있어요.</p>
        <Link className="button button--primary" href={`/s/${publicId}`}>스케치북으로 돌아가기</Link>
      </main>
    );
  }

  return (
    <SketchCanvas
      publicId={sketchbook.publicId}
      referenceImageUrl={sketchbook.referenceImageEnabled ? `/api/sketchbooks/${publicId}/reference/image` : null}
      sketchbookName={sketchbook.name}
    />
  );
}
