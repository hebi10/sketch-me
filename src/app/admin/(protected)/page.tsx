import { getCachedAdminStats } from '@/lib/admin/repository';
import { AdminDashboard } from './AdminDashboard';

export default async function AdminDashboardPage() {
  const stats = await getCachedAdminStats();
  return <AdminDashboard stats={stats} />;
}
