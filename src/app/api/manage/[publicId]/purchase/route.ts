import { NextResponse } from 'next/server';

import { normalizeBuyerPhone, requestPayAppPayment } from '@/lib/payments/payapp';
import {
  attachProviderPayment,
  createPendingPurchase,
  failPendingPurchase,
  PurchaseConflictError,
} from '@/lib/purchases/orders';
import { getManagedSketchbook } from '@/lib/sketchbooks/management';
import { DIGITAL_CONTENT_CONSENT_VERSION } from '@/lib/purchases/consent';
import { getPurchasePlan } from '@/lib/purchases/plans';

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) return NextResponse.json({ message: '관리 권한이 없습니다.' }, { status: 403 });
  const body = await request.json().catch(() => null) as {
    buyerPhone?: unknown;
    digitalContentConsent?: unknown;
    productId?: unknown;
    requestId?: unknown;
  } | null;
  const plan = getPurchasePlan(body?.productId);
  if (!plan) return NextResponse.json({ message: '선택한 상품을 확인해 주세요.' }, { status: 400 });
  if (body?.digitalContentConsent !== true) {
    return NextResponse.json(
      { message: '디지털 혜택 제공 시작 내용을 확인해 주세요.' },
      { status: 400 },
    );
  }
  const requestId = typeof body?.requestId === 'string' ? body.requestId : '';
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) {
    return NextResponse.json({ message: '결제 요청을 다시 시작해 주세요.' }, { status: 400 });
  }
  const buyerPhone = typeof body?.buyerPhone === 'string'
    ? normalizeBuyerPhone(body.buyerPhone)
    : null;
  if (!buyerPhone) {
    return NextResponse.json({ message: '휴대전화번호를 확인해 주세요.' }, { status: 400 });
  }

  let pending;
  try {
    pending = await createPendingPurchase({
      buyerPhone,
      digitalContentConsentVersion: DIGITAL_CONTENT_CONSENT_VERSION,
      plan,
      requestId,
      sketchbook,
    });
  } catch (error) {
    if (error instanceof PurchaseConflictError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    return NextResponse.json({ message: '결제 요청을 저장하지 못했습니다.' }, { status: 500 });
  }
  if (!pending.isNew && pending.payUrl && pending.paymentStatus === 'READY') {
    return NextResponse.json({ orderId: pending.orderId, payUrl: pending.payUrl });
  }
  if (!pending.isNew) {
    return NextResponse.json(
      { message: '이미 처리된 결제 요청입니다.', orderId: pending.orderId },
      { status: 409 },
    );
  }

  try {
    const payment = await requestPayAppPayment({
      buyerPhone,
      orderId: pending.orderId,
      plan,
      requestId,
    });
    await attachProviderPayment({
      orderId: pending.orderId,
      payUrl: payment.payUrl,
      providerOrderId: payment.providerOrderId,
    });
    return NextResponse.json({ orderId: pending.orderId, payUrl: payment.payUrl });
  } catch {
    try {
      await failPendingPurchase(pending.orderId);
    } catch {
      // 결제 공급자 오류를 안전하게 응답하는 것이 우선이며, 저장소 오류 원문은 노출하지 않습니다.
    }
    return NextResponse.json({ message: '결제창을 열지 못했습니다.' }, { status: 502 });
  }
}
