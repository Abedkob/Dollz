import { AdminShell } from '../../../components/admin-shell';
import { MediaLibrary } from '../../../components/media-library';
import { requireAdminSession } from '../../../lib/server-auth';

export default async function MediaPage() {
  const session = await requireAdminSession();
  return (
    <AdminShell session={session} active="media">
      <MediaLibrary csrfToken={session.csrfToken} />
    </AdminShell>
  );
}
