import { WorkspacePageHeader } from '@/components/ui/workspace-page-header';
import { TasksView } from '@/features/tasks/tasks-view';

/** Attività del workspace: cosa fare, entro quando, per quale candidatura. Caricata a richiesta. */
export function Component() {
  return (
    <>
      <WorkspacePageHeader
        title="Attività"
        description="Cosa devi fare, entro quando e per quale candidatura."
      />
      <TasksView />
    </>
  );
}
