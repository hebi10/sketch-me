'use client';

import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { ImageModeChooser } from './ImageModeChooser';

interface ImageCreationEntryProps {
  ariaLabel?: string;
  children?: ReactNode;
  className?: string;
  publicId: string;
}

export function ImageCreationEntry({
  ariaLabel = '이미지 제작',
  children = '이미지 제작',
  className,
  publicId,
}: ImageCreationEntryProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        aria-label={ariaLabel}
        className={className}
        onClick={() => setOpen(true)}
        ref={triggerRef}
        title={ariaLabel}
        type="button"
      >
        {children}
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
          <ImageModeChooser
            onClose={() => setOpen(false)}
            open
            publicId={publicId}
            triggerRef={triggerRef}
          />,
          document.body,
        )
        : null}
    </>
  );
}
