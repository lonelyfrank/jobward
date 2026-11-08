import { Outlet, useParams } from 'react-router';
import { OpportunitiesView } from '@/features/opportunities/opportunities-view';

/** Vista Tabella di una bacheca: gli stessi dati del Kanban, con ricerca e filtri sul server. */
export function Component() {
  const { boardId = '' } = useParams();
  return (
    <div className="board-table h-full overflow-y-auto">
      <div className="rounded-lg bg-surface p-3 sm:p-4">
        <OpportunitiesView fixedBoardId={boardId} />
      </div>
      <Outlet />
    </div>
  );
}
