'use client';

import { useRef, useState } from 'react';

import { BuyerPhoneField } from '@/components/ui/BuyerPhoneField';
import { PurchaseConsent } from '@/components/ui/PurchaseConsent';
import { openPaymentUrl } from '@/lib/payments/browser';
import { normalizeBuyerPhone } from '@/lib/payments/phone';

interface WatermarkPurchaseButtonProps {
  onPurchased: () => void;
  publicId: string;
}

export function WatermarkPurchaseButton({ publicId }: WatermarkPurchaseButtonProps) {
  const [buyerPhone, setBuyerPhone] = useState('');
  const [purchaseConsent, setPurchaseConsent] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef('');
  const isPurchasingRef = useRef(false);

  async function purchase() {
    if (isPurchasingRef.current || !purchaseConsent) return;
    if (!normalizeBuyerPhone(buyerPhone)) {
      setError('휴대전화번호를 확인해 주세요.');
      return;
    }
    if (!requestIdRef.current) {
      requestIdRef.current = globalThis.crypto?.randomUUID?.()
        ?? `purchase_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
    isPurchasingRef.current = true;
    setIsPurchasing(true);
    setError(null);

    try {
      const response = await fetch(`/api/manage/${publicId}/purchase`, {
        body: JSON.stringify({
          buyerPhone,
          digitalContentConsent: true,
          productId: 'WATERMARK_FREE',
          requestId: requestIdRef.current,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const result = await response.json().catch(() => ({})) as {
        message?: string;
        orderId?: string;
        payUrl?: string;
      };
      if (!response.ok || !result.orderId || !result.payUrl) {
        throw new Error(result.message ?? '결제를 처리하지 못했어요.');
      }
      openPaymentUrl(result.payUrl);
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
        <p>결제 완료 후 이 스케치북의 공유 이미지에서 워터마크가 빠져요.</p>
      </div>
      <BuyerPhoneField
        disabled={isPurchasing}
        error={error === '휴대전화번호를 확인해 주세요.' ? error : null}
        id="watermark-payment-phone"
        onChange={(value) => {
          setBuyerPhone(value);
          if (error === '휴대전화번호를 확인해 주세요.') setError(null);
        }}
        value={buyerPhone}
      />
      <PurchaseConsent
        checked={purchaseConsent}
        disabled={isPurchasing}
        id="watermark-purchase-consent"
        onChange={setPurchaseConsent}
      />
      <button className="button button--secondary" disabled={isPurchasing || !purchaseConsent} onClick={purchase} type="button">
        {isPurchasing ? '페이앱 연결 중...' : '워터마크 없이 저장하기 · 1,000원'}
      </button>
      {error && error !== '휴대전화번호를 확인해 주세요.'
        ? <p className="watermark-purchase__error" role="alert">{error}</p>
        : null}
    </section>
  );
}
