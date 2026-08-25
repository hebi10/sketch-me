import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AdminLogin } from './AdminLogin';
import {
  getAdminSessionCookieName,
  verifyAdminSessionCookie,
} from '@/lib/admin/auth';

export const metadata: Metadata = {
  title: '관리자 로그인',
};

export default async function AdminLoginPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(getAdminSessionCookieName())?.value;
  const identity = await verifyAdminSessionCookie(sessionCookie);

  if (identity) {
    redirect('/admin');
  }

  return (
    <main className="state-shell">
      <AdminLogin />
    </main>
  );
}
