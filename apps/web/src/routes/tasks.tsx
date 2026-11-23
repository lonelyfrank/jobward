import { WorkspacePageHeader } from '@/components/ui/workspace-page-header';
import { TasksView } from '@/features/tasks/tasks-view';

/**
 * Attività del workspace: cosa fare, entro quando, per quale candidatura. Caricata a richiesta.
 * Pagina a tutta altezza: intestazione, riepilogo, filtri e inserimento restano fermi; scorre solo
 * l'elenco (con le intestazioni delle sezioni in cima). Se la finestra è troppo bassa scorre la pagina.
 */
export function Component() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-5 pb-6 sm:px-6 lg:px-8">
      <WorkspacePageHeader title="Attività" />
      <TasksView />
    </div>
  );
}
