import { AdminDashboard } from "@/components/admin-dashboard";
import {
  listUsers,
  listGroups,
  getSecuritySettings,
  getAuditLogs,
  getStorageStats,
  listSharedPostLinks,
  listAccountChangeRequests
} from "@/app/(app)/admin/actions";

export default async function AdminPage() {
  const [users, groups, securitySettings, { logs: auditLogs, total: auditTotal }, storageStats, sharedLinks, accountRequests] =
    await Promise.all([listUsers(), listGroups(), getSecuritySettings(), getAuditLogs(), getStorageStats(), listSharedPostLinks(), listAccountChangeRequests()]);

  return (
    <AdminDashboard
      users={users}
      groups={groups}
      securitySettings={securitySettings}
      auditLogs={auditLogs}
      auditTotal={auditTotal}
      storageStats={storageStats}
      sharedLinks={sharedLinks}
      accountRequests={accountRequests}
    />
  );
}
