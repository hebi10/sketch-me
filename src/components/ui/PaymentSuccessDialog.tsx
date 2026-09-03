'use client';

import {
  type MouseEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from 'react';

interface PaymentSuccessDialogProps {
  description: string;
  onClose: () => void;
  open: boolean;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

export function PaymentSuccessDialog({
  description,
  onClose,
  open,
  returnFocusRef,
}: PaymentSuccessDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const trigger = returnFocusRef.current;
    if (!dialog) return;

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    dialog.querySelector<HTMLElement>('button')?.focus();

    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      trigger?.focus();
    };
  }, [open, returnFocusRef]);

  if (!open) return null;

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div className="purchase-dialog-backdrop" onMouseDown={closeFromBackdrop}>
      <dialog
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="purchase-dialog"
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
        ref={dialogRef}
      >
        <div className="purchase-dialog-heading">
          <h2 id={titleId}>결제 완료</h2>
        </div>
        <p className="purchase-dialog-copy">모의 결제가 완료됐습니다</p>
        <p className="purchase-dialog-copy" id={descriptionId}>{description}</p>
        <button className="button button--primary purchase-submit" onClick={onClose} type="button">
          확인
        </button>
      </dialog>
    </div>
  );
}
