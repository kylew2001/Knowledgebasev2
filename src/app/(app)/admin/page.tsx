import { AdminDashboard } from "@/components/admin-dashboard";
import {
  listUsers,
  getSecuritySettings,
  getAuditLogs,
  getStorageStats
} from "@/app/(app)/admin/actions";

export default async function AdminPage() {
  const [users, securitySettings, { logs: auditLogs, total: auditTotal }, storageStats] =
    await Promise.all([listUsers(), getSecuritySettings(), getAuditLogs(), getStorageStats()]);

  return (
    <AdminDashboard
      users={users}
      securitySettings={securitySettings}
      auditLogs={auditLogs}
      auditTotal={auditTotal}
      storageStats={storageStats}
    />
  );
}
