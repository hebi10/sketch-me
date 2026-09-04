'use client';

import { useEffect, useRef, useState } from 'react';

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
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const requestIdRef = useRef('');
  const isPurchasingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    if (!dialog) return;

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');

    const focusableSelector = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!isPurchasingRef.current) setIsOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    dialog.querySelector<HTMLElement>(focusableSelector)?.focus();

    return () => {
      dialog.removeEventListener('keydown', handleKeyDown);
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      trigger?.focus();
    };
  }, [isOpen]);

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
    <>
      <button
        className="button button--secondary watermark-purchase-trigger"
        onClick={() => setIsOpen(true)}
        ref={triggerRef}
        type="button"
      >
        워터마크 없이 저장하기 · 1,000원
      </button>
      {isOpen ? (
        <div
          className="purchase-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isPurchasing) setIsOpen(false);
          }}
        >
          <dialog
            aria-busy={isPurchasing}
            aria-labelledby="watermark-purchase-title"
            className="purchase-dialog watermark-purchase-dialog"
            onCancel={(event) => {
              event.preventDefault();
              if (!isPurchasing) setIsOpen(false);
            }}
            ref={dialogRef}
          >
            <div className="purchase-dialog-heading">
              <h2 id="watermark-purchase-title">워터마크 없이 저장하기</h2>
              <button
                aria-label="결제창 닫기"
                className="purchase-dialog-close"
                disabled={isPurchasing}
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <p className="purchase-dialog-copy">
              공유 이미지를 워터마크 없이 저장하고 싶나요? 1,000원으로 모든 이미지 제작에서 워터마크가 빠져요.
            </p>
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
            {error && error !== '휴대전화번호를 확인해 주세요.'
              ? <p className="purchase-error" role="alert">{error}</p>
              : null}
            <button
              className="button button--primary purchase-submit"
              disabled={isPurchasing || !purchaseConsent}
              onClick={purchase}
              type="button"
            >
              {isPurchasing ? '페이앱 연결 중...' : '1,000원 결제하기'}
            </button>
          </dialog>
        </div>
      ) : null}
    </>
  );
}
