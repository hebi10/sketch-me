import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StoryImageMaker } from './StoryImageMaker';
import { getManagedSketchbook } from '@/lib/sketchbooks/management';

export const dynamic = 'force-dynamic';

export default async function SharePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) notFound();
  return <main className="share-shell"><Link href={`/m/${publicId}`}>← 내 스캐치북</Link><section className="story-preview"><p>친구들이 그린 나</p><h1>{sketchbook.name} BEST 4</h1><div>BEST 그림 결과물</div><span>1080 × 1920 스토리 이미지</span></section><StoryImageMaker name={sketchbook.name} publicUrl={`/s/${publicId}`} /></main>;
}
