'use client';

import {
  type MouseEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from 'react';

import { Button } from '@/components/ui/Button';

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

type AdminModerationDialogProps = {
  confirmLabel: string;
  description: string;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
  pendingLabel: string;
  processing: boolean;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  title: string;
};

export function AdminModerationDialog({
  confirmLabel,
  description,
  error,
  onClose,
  onConfirm,
  open,
  pendingLabel,
  processing,
  returnFocusRef,
  title,
}: AdminModerationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const processingRef = useRef(processing);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    processingRef.current = processing;
  }, [processing]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const trigger = returnFocusRef.current;
    if (!dialog) return;

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!processingRef.current) onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
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
      else dialog.removeAttribute('open');
      trigger?.focus();
    };
  }, [onClose, open, returnFocusRef]);

  if (!open) return null;

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !processing) onClose();
  }

  return (
    <div className="admin-moderation-backdrop" onMouseDown={closeFromBackdrop}>
      <dialog
        aria-busy={processing}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="admin-moderation-dialog"
        onCancel={(event) => {
          event.preventDefault();
          if (!processing) onClose();
        }}
        ref={dialogRef}
      >
        <div className="admin-moderation-dialog-heading">
          <div>
            <p className="eyebrow">운영 상태</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            aria-label="상태 변경 닫기"
            className="admin-moderation-dialog-close"
            disabled={processing}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <p className="admin-moderation-dialog-copy" id={descriptionId}>{description}</p>
        {error ? <p className="admin-moderation-error" role="alert">{error}</p> : null}
        <div className="admin-moderation-actions">
          <Button disabled={processing} onClick={onClose} variant="secondary">
            취소
          </Button>
          <Button disabled={processing} onClick={onConfirm} variant="danger">
            {processing ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
