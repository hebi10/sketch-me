import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  getAdminSessionCookieName,
  verifyAdminSessionCookie,
  type AdminIdentity,
} from './auth';

export async function getRequiredAdminIdentity(): Promise<AdminIdentity> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(getAdminSessionCookieName())?.value;
  const identity = await verifyAdminSessionCookie(sessionCookie);

  if (!identity) {
    redirect('/admin/login');
  }

  return identity;
}
