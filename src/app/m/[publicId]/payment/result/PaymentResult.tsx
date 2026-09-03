'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { PurchaseProductId, PurchaseStatus } from '@/lib/domain/types';

interface PaymentResultProps {
  orderId: string;
  publicId: string;
}

interface PaymentStatusResponse {
  amount: number;
  paymentStatus: PurchaseStatus;
  productType: PurchaseProductId;
}

const descriptions: Record<PurchaseProductId, string> = {
  FRIENDS_10: '친구 그림 10명 추가가 적용됐어요.',
  FRIENDS_50: '친구 그림 50명 추가가 적용됐어요.',
  FRIENDS_100: '친구 그림 100명 추가가 적용됐어요.',
  WATERMARK_FREE: '워터마크 제거가 적용됐어요.',
};

export function PaymentResult({ orderId, publicId }: PaymentResultProps) {
  const [result, setResult] = useState<PaymentStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attemptRef = useRef(0);

  const checkStatus = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(
        `/api/manage/${encodeURIComponent(publicId)}/purchases/${encodeURIComponent(orderId)}`,
        { cache: 'no-store', signal },
      );
      const body = await response.json().catch(() => ({})) as PaymentStatusResponse & { message?: string };
      if (!response.ok) throw new Error(body.message ?? '결제 결과를 확인하지 못했습니다.');
      setResult(body);
      setError(null);
      return body.paymentStatus;
    } catch (requestError) {
      if (signal?.aborted) return null;
      setError(requestError instanceof Error ? requestError.message : '결제 결과를 확인하지 못했습니다.');
      return null;
    }
  }, [orderId, publicId]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      attemptRef.current += 1;
      const status = await checkStatus(controller.signal);
      if (!controller.signal.aborted && status === 'READY' && attemptRef.current < 15) {
        timer = setTimeout(poll, 2_000);
      }
    };
    void poll();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [checkStatus]);

  const status = result?.paymentStatus;
  const content = status === 'SUCCEEDED'
    ? {
        description: descriptions[result?.productType ?? 'WATERMARK_FREE'],
        title: '결제가 완료됐습니다',
      }
    : status === 'CANCELLED'
      ? { description: '승인 취소 내역은 카드사 또는 결제수단에서 확인해 주세요.', title: '결제가 취소됐습니다' }
      : status === 'REVIEW_REQUIRED'
        ? { description: '혜택은 적용되지 않았습니다. 주문번호와 함께 고객센터로 문의해 주세요.', title: '결제 확인이 필요합니다' }
      : status === 'FAILED'
        ? { description: '결제수단을 확인한 뒤 다시 시도해 주세요.', title: '결제를 완료하지 못했습니다' }
        : { description: '페이앱의 완료 통보를 기다리고 있어요. 잠시만 기다려 주세요.', title: '결제 결과를 확인하고 있습니다' };

  return (
    <section aria-live="polite" className="payment-result-card">
      <h1>{content.title}</h1>
      <p>{content.description}</p>
      {status === 'READY' ? <progress aria-label="결제 결과 확인 중" /> : null}
      {error ? (
        <div className="payment-result-error" role="alert">
          <p>{error}</p>
          <button className="button button--secondary" onClick={() => void checkStatus()} type="button">다시 확인하기</button>
        </div>
      ) : null}
      <Link className="button button--primary" href={`/m/${publicId}`}>관리 화면으로 돌아가기</Link>
    </section>
  );
}
