import { NextResponse } from 'next/server';

import { getManagedSketchbook } from '@/lib/sketchbooks/management';
import { addMockPurchase } from '@/lib/sketchbooks/repository';
import { getServerPaymentMode } from '@/lib/purchases/mode';
import { getPurchasePlan } from '@/lib/purchases/plans';

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  if (getServerPaymentMode() !== 'MOCK') {
    return NextResponse.json({ message: '결제 기능을 준비하고 있어요. 현재는 결제를 진행할 수 없습니다.' }, { status: 503 });
  }
  const { publicId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) return NextResponse.json({ message: '관리 권한이 없습니다.' }, { status: 403 });
  const body = await request.json().catch(() => null) as { productId?: unknown; requestId?: unknown } | null;
  const plan = getPurchasePlan(body?.productId);
  if (!plan) return NextResponse.json({ message: '선택한 상품을 확인해 주세요.' }, { status: 400 });
  const requestId = typeof body?.requestId === 'string' ? body.requestId : '';
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) {
    return NextResponse.json({ message: '결제 요청을 다시 시작해 주세요.' }, { status: 400 });
  }
  const result = await addMockPurchase(sketchbook, plan, requestId);
  return NextResponse.json(result);
}
