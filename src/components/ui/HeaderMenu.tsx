'use client';

import { useRef } from 'react';

export function HeaderMenu({ children, label = '메뉴' }: { children: React.ReactNode; label?: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <details className="header-menu" ref={detailsRef}>
      <summary aria-label={label}>☰</summary>
      <nav
        aria-label={`${label} 항목`}
        onClick={() => { if (detailsRef.current) detailsRef.current.open = false; }}
      >
        {children}
      </nav>
    </details>
  );
}
