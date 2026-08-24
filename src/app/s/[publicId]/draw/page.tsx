import { notFound } from 'next/navigation';

import { SketchCanvas } from './SketchCanvas';
import { findSketchbookByPublicId } from '@/lib/sketchbooks/repository';

export const dynamic = 'force-dynamic';

export default async function DrawFriendPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const sketchbook = await findSketchbookByPublicId(publicId);

  if (!sketchbook || sketchbook.status !== 'PUBLIC') notFound();

  return (
    <SketchCanvas
      publicId={sketchbook.publicId}
      referenceImageUrl={sketchbook.referenceImageEnabled ? `/api/sketchbooks/${publicId}/reference/image` : null}
      sketchbookName={sketchbook.name}
    />
  );
}
