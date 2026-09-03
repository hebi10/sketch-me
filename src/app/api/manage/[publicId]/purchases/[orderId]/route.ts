import { NextResponse } from 'next/server';

import { getManagedPurchase } from '@/lib/purchases/orders';
import { getManagedSketchbook } from '@/lib/sketchbooks/management';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string; publicId: string }> },
) {
  const { orderId, publicId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) {
    return NextResponse.json({ message: '관리 권한이 없습니다.' }, { status: 403 });
  }

  const purchase = await getManagedPurchase(publicId, orderId);
  if (!purchase || purchase.sketchbookId !== sketchbook.id) {
    return NextResponse.json({ message: '결제 주문을 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({
    amount: purchase.amount,
    paymentStatus: purchase.paymentStatus,
    productType: purchase.productType,
  });
}
