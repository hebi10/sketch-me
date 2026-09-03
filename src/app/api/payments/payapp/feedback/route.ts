import { getPayAppConfig, verifyPayAppFeedback } from '@/lib/payments/payapp';
import { applyPayAppFeedback } from '@/lib/purchases/orders';

function text(message: string, status: number) {
  return new Response(message, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    status,
  });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const values = {
      linkkey: String(form.get('linkkey') ?? ''),
      linkval: String(form.get('linkval') ?? ''),
      userid: String(form.get('userid') ?? ''),
    };
    if (!verifyPayAppFeedback(values, getPayAppConfig())) {
      return text('INVALID', 400);
    }

    const amountText = String(form.get('price') ?? '');
    const orderId = String(form.get('var1') ?? '');
    const payState = String(form.get('pay_state') ?? '');
    const providerOrderId = String(form.get('mul_no') ?? '');
    if (
      !/^\d+$/.test(amountText)
      || !/^[a-zA-Z0-9_-]{8,200}$/.test(orderId)
      || !/^\d+$/.test(providerOrderId)
      || !/^\d+$/.test(payState)
    ) {
      return text('INVALID', 400);
    }

    await applyPayAppFeedback({
      amount: Number(amountText),
      orderId,
      payState,
      payType: String(form.get('pay_type') ?? '') || undefined,
      providerOrderId,
    });
    return text('SUCCESS', 200);
  } catch {
    return text('INVALID', 400);
  }
}
