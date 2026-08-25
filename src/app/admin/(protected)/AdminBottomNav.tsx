'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ADMIN_NAV_ITEMS = [
  { href: '/admin', label: '대시보드' },
  { href: '/admin/sketchbooks', label: '스케치북' },
  { href: '/admin/drawings', label: '그림' },
  { href: '/admin/purchases', label: '결제' },
] as const;

function isCurrentAdminPath(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminBottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="관리자 메뉴" className="admin-bottom-nav">
      {ADMIN_NAV_ITEMS.map((item) => {
        const isCurrent = isCurrentAdminPath(pathname, item.href);
        return (
          <Link
            aria-current={isCurrent ? 'page' : undefined}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
