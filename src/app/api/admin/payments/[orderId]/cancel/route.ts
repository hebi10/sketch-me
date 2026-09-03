import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  getAdminSessionCookieName,
  verifyAdminSessionCookie,
} from '@/lib/admin/auth';
import { isAllowedAdminOrigin } from '@/lib/admin/origin';
import { cancelPayAppPayment } from '@/lib/payments/payapp';
import {
  findPurchaseByOrderId,
  markPurchaseCancelRequested,
} from '@/lib/purchases/orders';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!isAllowedAdminOrigin(request)) {
    return NextResponse.json({ message: '허용되지 않은 요청입니다.' }, { status: 403 });
  }
  const cookieStore = await cookies();
  const identity = await verifyAdminSessionCookie(
    cookieStore.get(getAdminSessionCookieName())?.value,
  );
  if (!identity) {
    return NextResponse.json({ message: '관리자 로그인이 필요합니다.' }, { status: 401 });
  }

  const { orderId } = await params;
  if (!/^[a-zA-Z0-9_-]{8,200}$/.test(orderId)) {
    return NextResponse.json({ message: '주문번호를 확인해 주세요.' }, { status: 400 });
  }
  const purchase = await findPurchaseByOrderId(orderId);
  if (!purchase) {
    return NextResponse.json({ message: '결제 주문을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (
    purchase.provider !== 'PAYAPP'
    || !['SUCCEEDED', 'REVIEW_REQUIRED'].includes(purchase.paymentStatus)
    || !purchase.providerOrderId
    || purchase.cancelRequestedAt
  ) {
    return NextResponse.json({ message: '전체 취소할 수 없는 주문입니다.' }, { status: 409 });
  }

  try {
    await cancelPayAppPayment({
      cancelMemo: '관리자 전체 취소',
      providerOrderId: purchase.providerOrderId,
    });
    await markPurchaseCancelRequested(orderId);
    return NextResponse.json({ cancelRequested: true });
  } catch {
    return NextResponse.json(
      {
        message: '페이앱에서 즉시 취소할 수 없습니다. 정산 완료 여부를 확인하고 판매자 사이트에서 취소 요청해 주세요.',
      },
      { status: 502 },
    );
  }
}
