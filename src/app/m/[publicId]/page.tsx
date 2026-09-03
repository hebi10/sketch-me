import { notFound, redirect } from 'next/navigation';

import { ManageDashboard } from './ManageDashboard';
import { getManagedSketchbook } from '@/lib/sketchbooks/management';
import { findSketchbookByPublicId, listDrawings } from '@/lib/sketchbooks/repository';

export const dynamic = 'force-dynamic';

export default async function ManagePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) {
    if (await findSketchbookByPublicId(publicId)) redirect(`/m/${publicId}/login`);
    notFound();
  }
  const drawings = await listDrawings(sketchbook.id);
  return <ManageDashboard drawings={drawings} entitlements={sketchbook.entitlements} moderationStatus={sketchbook.moderationStatus} name={sketchbook.name} ownerBestRank={sketchbook.ownerBestRank} ownerDrawingPath={sketchbook.ownerDrawingPath} participantCount={sketchbook.participantCount} participantLimit={sketchbook.participantLimit} publicId={publicId} />;
}
