'use client';

import Link from 'next/link';
import { useEffect, useRef, type RefObject } from 'react';

interface ImageModeChooserProps {
  dismissHref?: string;
  onClose?: () => void;
  open: boolean;
  publicId: string;
  triggerRef?: RefObject<HTMLElement | null>;
}

const modeOptions = [
  {
    description: '그림 한 장을 정사각형 공유 이미지로 만들어요.',
    label: '그림 하나 제작하기',
    mode: 'single',
    ratio: '1080 × 1080',
  },
  {
    description: '선정한 BEST 그림을 한 장에 모아 만들어요.',
    label: 'BEST 이미지 제작하기',
    mode: 'best',
    ratio: '1080 × 1440',
  },
] as const;

export function ImageModeChooser({
  dismissHref,
  onClose,
  open,
  publicId,
  triggerRef,
}: ImageModeChooserProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const main = document.querySelector('main');
    const trigger = triggerRef?.current;
    if (!dialog) return;

    main?.setAttribute('inert', '');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');

    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.preventDefault();
        onClose();
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
    dialog.querySelector<HTMLElement>('.image-mode-option')?.focus();

    return () => {
      dialog.removeEventListener('keydown', handleKeyDown);
      main?.removeAttribute('inert');
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      trigger?.focus();
    };
  }, [onClose, open, triggerRef]);

  if (!open) return null;

  return (
    <div className="image-mode-dialog-backdrop">
      <dialog
        aria-labelledby="image-mode-dialog-title"
        className="image-mode-dialog"
        onCancel={(event) => {
          event.preventDefault();
          onClose?.();
        }}
        ref={dialogRef}
      >
        <div className="image-mode-dialog-heading">
          <h2 id="image-mode-dialog-title">이미지 제작 방식 선택</h2>
          {onClose ? (
            <button aria-label="이미지 제작 방식 선택 닫기" onClick={onClose} type="button">×</button>
          ) : dismissHref ? (
            <Link aria-label="이미지 제작 방식 선택 닫기" href={dismissHref}>×</Link>
          ) : null}
        </div>
        <div className="image-mode-options">
          {modeOptions.map((option) => (
            <Link
              className="image-mode-option"
              href={`/m/${publicId}/share?mode=${option.mode}`}
              key={option.mode}
            >
              <strong>{option.label}</strong>
              <span>{option.ratio}</span>
              <p>{option.description}</p>
            </Link>
          ))}
        </div>
      </dialog>
    </div>
  );
}
