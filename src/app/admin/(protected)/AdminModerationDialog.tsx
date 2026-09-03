'use client';

import {
  type MouseEvent,
  type ReactNode,
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
  children?: ReactNode;
  closeLabel?: string;
  confirmDisabled?: boolean;
  confirmLabel: string;
  confirmVariant: 'danger' | 'primary';
  description: string;
  error: string | null;
  eyebrow?: string | null;
  initialFocusSelector?: string;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
  pendingLabel: string;
  processing: boolean;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  title: string;
};

export function AdminModerationDialog({
  children,
  closeLabel = '상태 변경 닫기',
  confirmDisabled = false,
  confirmLabel,
  confirmVariant,
  description,
  error,
  eyebrow = '운영 상태',
  initialFocusSelector,
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
  const wasProcessingRef = useRef(false);
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

      if (processingRef.current) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const focusable = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)];
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
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
    const initialFocus = initialFocusSelector
      ? dialog.querySelector<HTMLElement>(initialFocusSelector)
      : null;
    (initialFocus ?? dialog.querySelector<HTMLElement>(focusableSelector))?.focus();

    return () => {
      dialog.removeEventListener('keydown', handleKeyDown);
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      trigger?.focus();
    };
  }, [initialFocusSelector, onClose, open, returnFocusRef]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) {
      wasProcessingRef.current = false;
      return;
    }

    if (processing) {
      wasProcessingRef.current = true;
      dialog.focus();
      return;
    }

    if (wasProcessingRef.current) {
      wasProcessingRef.current = false;
      dialog.querySelector<HTMLElement>('[data-admin-dialog-confirm]')?.focus();
    }
  }, [open, processing]);

  if (!open) return null;

  function closeFromBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget || processingRef.current) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const outsideDialog = event.clientX < bounds.left
      || event.clientX > bounds.right
      || event.clientY < bounds.top
      || event.clientY > bounds.bottom;
    if (outsideDialog) onClose();
  }

  return (
    <dialog
      aria-busy={processing}
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-modal="true"
      className="admin-moderation-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!processingRef.current) onClose();
      }}
      onClick={closeFromBackdrop}
      ref={dialogRef}
      tabIndex={-1}
    >
      <div className="admin-moderation-dialog-heading">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2 id={titleId}>{title}</h2>
        </div>
        <button
          aria-label={closeLabel}
          className="admin-moderation-dialog-close"
          disabled={processing}
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </div>
      <p className="admin-moderation-dialog-copy" id={descriptionId}>{description}</p>
      {children}
      {processing ? (
        <span aria-live="polite" className="sr-only" role="status">
          {pendingLabel}
        </span>
      ) : null}
      {error ? <p className="admin-moderation-error" role="alert">{error}</p> : null}
      <div className="admin-moderation-actions">
        <Button disabled={processing} onClick={onClose} variant="secondary">
          취소
        </Button>
        <Button
          data-admin-dialog-confirm
          disabled={processing || confirmDisabled}
          onClick={onConfirm}
          variant={confirmVariant}
        >
          {processing ? pendingLabel : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
