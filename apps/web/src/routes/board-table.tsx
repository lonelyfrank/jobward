import { Outlet, useParams } from 'react-router';
import { OpportunitiesView } from '@/features/opportunities/opportunities-view';

/** Vista Tabella di una bacheca: gli stessi dati del Kanban, con ricerca e filtri sul server. */
export function Component() {
  const { boardId = '' } = useParams();
  return (
    <div className="h-full overflow-y-auto px-4 pb-8 sm:px-8">
      <OpportunitiesView fixedBoardId={boardId} />
      <Outlet />
    </div>
  );
}
