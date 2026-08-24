import { NextResponse } from 'next/server';

import { getManagedSketchbook } from '@/lib/sketchbooks/management';
import { addMockPurchase } from '@/lib/sketchbooks/repository';

export async function POST(_request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) return NextResponse.json({ message: '관리 권한이 없습니다.' }, { status: 403 });
  await addMockPurchase(sketchbook);
  return NextResponse.json({ participantLimit: sketchbook.participantLimit + 20 });
}
