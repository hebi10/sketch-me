import type { PropsWithChildren } from 'react';

type DialogProps = PropsWithChildren<{
  open: boolean;
  title: string;
  onClose: () => void;
}>;

export function Dialog({ children, open, title, onClose }: DialogProps) {
  if (!open) return null;

  return (
    <div aria-modal="true" className="dialog-backdrop" role="dialog" aria-label={title}>
      <div className="dialog-panel">
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button aria-label="닫기" className="icon-button" onClick={onClose} type="button">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
