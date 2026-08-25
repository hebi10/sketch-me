import type { PropsWithChildren } from 'react';

import { BrandWordmark } from '@/components/ui/BrandWordmark';
import type { AdminIdentity } from '@/lib/admin/auth';
import { AdminBottomNav } from './AdminBottomNav';
import { AdminLogoutButton } from './AdminLogoutButton';

type AdminShellProps = PropsWithChildren<{
  identity: AdminIdentity;
}>;

export function AdminShell({ children, identity }: AdminShellProps) {
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-brand">
          <BrandWordmark />
          <span className="admin-role">관리자</span>
        </div>
        <AdminLogoutButton />
      </header>
      <p className="admin-identity" title={identity.email}>{identity.email}</p>
      <main className="admin-main">{children}</main>
      <AdminBottomNav />
    </div>
  );
}
