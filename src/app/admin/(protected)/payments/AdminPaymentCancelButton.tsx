'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AdminPaymentCancelButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function cancelPayment() {
    if (
      isSubmitting
      || !window.confirm(
        '페이앱에 즉시 전체 취소를 요청할까요? 정산 완료 거래는 판매자 사이트에서 별도 취소 요청과 반환금 입금이 필요합니다. 적용된 혜택은 자동 회수되지 않습니다.',
      )
    ) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/payments/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
      });
      const result = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? '결제 취소를 요청하지 못했습니다.');
      setMessage('전체 취소를 요청했습니다.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '결제 취소를 요청하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="admin-payment-cancel">
      <button className="button button--danger" disabled={isSubmitting} onClick={cancelPayment} type="button">
        {isSubmitting ? '취소 요청 중...' : '전체 취소'}
      </button>
      {message ? <p aria-live="polite">{message}</p> : null}
    </div>
  );
}
