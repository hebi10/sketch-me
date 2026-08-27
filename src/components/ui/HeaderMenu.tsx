'use client';

import { useRef } from 'react';

export function HeaderMenu({ children, iconGrid = false, label = '메뉴' }: { children: React.ReactNode; iconGrid?: boolean; label?: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <details className="header-menu" ref={detailsRef}>
      <summary aria-label={label}>☰</summary>
      <nav
        aria-label={`${label} 항목`}
        className={iconGrid ? 'header-menu__icon-grid' : undefined}
        onClick={() => { if (detailsRef.current) detailsRef.current.open = false; }}
      >
        {children}
      </nav>
    </details>
  );
}
