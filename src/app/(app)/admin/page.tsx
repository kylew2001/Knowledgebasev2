import { AdminDashboard } from "@/components/admin-dashboard";
import {
  listUsers,
  listGroups,
  getSecuritySettings,
  getAuditLogs,
  getStorageStats
} from "@/app/(app)/admin/actions";

export default async function AdminPage() {
  const [users, groups, securitySettings, { logs: auditLogs, total: auditTotal }, storageStats] =
    await Promise.all([listUsers(), listGroups(), getSecuritySettings(), getAuditLogs(), getStorageStats()]);

  return (
    <AdminDashboard
      users={users}
      groups={groups}
      securitySettings={securitySettings}
      auditLogs={auditLogs}
      auditTotal={auditTotal}
      storageStats={storageStats}
    />
  );
}
