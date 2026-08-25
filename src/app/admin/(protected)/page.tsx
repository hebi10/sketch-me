import { getCachedAdminStats } from '@/lib/admin/repository';
import { getRequiredAdminIdentity } from '@/lib/admin/server-session';
import { AdminDashboard } from './AdminDashboard';

export default async function AdminDashboardPage() {
  // Security boundary: every protected admin data page repeats this check
  // immediately before repository access. The shared layout guard is UX only.
  await getRequiredAdminIdentity();
  const stats = await getCachedAdminStats();
  return <AdminDashboard stats={stats} />;
}
