'use client';

import { useRef, useState } from 'react';

import type { SketchbookEntitlements } from '@/lib/domain/types';

interface WatermarkPurchaseButtonProps {
  onPurchased: () => void;
  publicId: string;
}

export function WatermarkPurchaseButton({ onPurchased, publicId }: WatermarkPurchaseButtonProps) {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPurchasingRef = useRef(false);

  async function purchase() {
    if (isPurchasingRef.current) return;
    isPurchasingRef.current = true;
    setIsPurchasing(true);
    setError(null);
    const requestId = globalThis.crypto?.randomUUID?.() ?? `purchase_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    try {
      const response = await fetch(`/api/manage/${publicId}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: 'WATERMARK_FREE', requestId }),
      });
      const result = await response.json().catch(() => ({})) as {
        entitlements?: SketchbookEntitlements;
        message?: string;
      };
      if (!response.ok || !result.entitlements?.watermarkFree) {
        throw new Error(result.message ?? '결제를 처리하지 못했어요.');
      }
      onPurchased();
    } catch (purchaseError) {
      const message = purchaseError instanceof Error ? purchaseError.message : '결제를 처리하지 못했어요.';
      setError(`${message} 다시 시도해 주세요.`);
    } finally {
      isPurchasingRef.current = false;
      setIsPurchasing(false);
    }
  }

  return (
    <section aria-label="워터마크 제거" className="watermark-purchase">
      <div>
        <strong>결과 이미지를 깔끔하게 저장하고 싶나요?</strong>
        <p>한 번 적용하면 이 스케치북의 공유 이미지에서 워터마크가 빠져요.</p>
      </div>
      <button className="button button--secondary" disabled={isPurchasing} onClick={purchase} type="button">
        {isPurchasing ? '모의 결제 처리 중...' : '워터마크 없이 저장하기 · 990원'}
      </button>
      <small>현재는 실제 금액이 청구되지 않는 모의 결제입니다.</small>
      {error ? <p className="watermark-purchase__error" role="alert">{error}</p> : null}
    </section>
  );
}
