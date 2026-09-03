import { NextResponse } from 'next/server';

import { findPurchaseByOrderId } from '@/lib/purchases/orders';

async function handleReturn(request: Request) {
  const requestUrl = new URL(request.url);
  let orderId = requestUrl.searchParams.get('orderId') ?? '';
  if (!orderId && request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    orderId = String(form?.get('var1') ?? '');
  }

  const purchase = /^[a-zA-Z0-9_-]{8,200}$/.test(orderId)
    ? await findPurchaseByOrderId(orderId)
    : null;
  const destination = purchase
    ? `/m/${encodeURIComponent(purchase.sketchbookPublicId)}/payment/result?orderId=${encodeURIComponent(orderId)}`
    : '/';
  return NextResponse.redirect(new URL(destination, requestUrl.origin), 303);
}

export const GET = handleReturn;
export const POST = handleReturn;
