import { AdminDashboard } from "@/components/admin-dashboard";
import { listUsers } from "@/app/(app)/admin/actions";

export default async function AdminPage() {
  const users = await listUsers();
  return <AdminDashboard users={users} />;
}
