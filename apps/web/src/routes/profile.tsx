import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { UserAvatar } from '@/components/ui/user-avatar';
import { WorkspacePageHeader } from '@/components/ui/workspace-page-header';
import { useWorkspace } from '@/features/workspace/context';

export function ProfilePage() {
  const { user, workspace } = useWorkspace();
  const name = user.email.split('@')[0] || user.email;

  return (
    <>
      <WorkspacePageHeader
        title="Profilo"
        description="Il tuo account e lo spazio in cui organizzi la ricerca del lavoro."
      />
      <div className="max-w-2xl space-y-6">
        <Surface className="p-6">
          <div className="flex items-center gap-4">
            <UserAvatar email={user.email} className="size-14 text-xl" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold break-words">{name}</h2>
              <p className="mt-1 text-sm break-all text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </Surface>
        <Surface className="p-6">
          <h2 className="text-[17px] font-bold">Il tuo workspace</h2>
          <dl className="mt-4 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Nome</dt>
            <dd className="break-words">{workspace.name}</dd>
            <dt className="text-muted-foreground">Ruolo</dt>
            <dd>{workspace.role === 'owner' ? 'Proprietario' : workspace.role}</dd>
            <dt className="text-muted-foreground">Fuso orario</dt>
            <dd className="break-words">{workspace.timezone}</dd>
          </dl>
        </Surface>
        <Button asChild variant="secondary">
          <Link to="/settings">Apri le impostazioni</Link>
        </Button>
      </div>
    </>
  );
}
