import { notFound } from 'next/navigation';

import { ManageDashboard } from './ManageDashboard';
import { getManagedSketchbook } from '@/lib/sketchbooks/management';
import { listDrawings } from '@/lib/sketchbooks/repository';

export const dynamic = 'force-dynamic';

export default async function ManagePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) notFound();
  const drawings = await listDrawings(sketchbook.id);
  return <ManageDashboard drawings={drawings} name={sketchbook.name} participantCount={sketchbook.participantCount} participantLimit={sketchbook.participantLimit} publicId={publicId} />;
}
