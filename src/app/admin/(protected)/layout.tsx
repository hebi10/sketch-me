import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';

import { getRequiredAdminIdentity } from '@/lib/admin/server-session';
import { AdminShell } from './AdminShell';

export const metadata: Metadata = {
  title: '관리자',
};

export default async function ProtectedAdminLayout({ children }: PropsWithChildren) {
  const identity = await getRequiredAdminIdentity();

  return <AdminShell identity={identity}>{children}</AdminShell>;
}
