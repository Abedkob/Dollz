import { AdminShell } from '../../../components/admin-shell';
import { SettingsPanel } from '../../../components/settings-panel';
import type { SystemStatus, WorkspaceSettings } from '../../../lib/settings';
import { adminApiServer, requireAdminSession } from '../../../lib/server-auth';

export default async function SettingsPage() {
  const session = await requireAdminSession();
  const [settings, status] = await Promise.all([
    adminApiServer<{ settings: WorkspaceSettings }>('settings'),
    adminApiServer<SystemStatus>('settings/system-status'),
  ]);
  if (!settings || !status)
    return (
      <AdminShell session={session} active="settings">
        <div className="catalog-loading">
          Settings are unavailable. Apply the latest database migration and try
          again.
        </div>
      </AdminShell>
    );
  return (
    <AdminShell session={session} active="settings">
      <SettingsPanel
        session={session}
        initialSettings={settings.settings}
        systemStatus={status}
      />
    </AdminShell>
  );
}
