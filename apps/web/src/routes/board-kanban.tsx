import { Outlet, useParams } from 'react-router';
import { useBoardDetail } from '@/features/boards/api';
import { KanbanBoard } from '@/features/kanban/kanban-board';

/** Vista Kanban di una bacheca (la bacheca è già in cache: la carica `BoardPage`). */
export function Component() {
  const { boardId = '' } = useParams();
  const board = useBoardDetail(boardId);
  return (
    <>
      {board.data ? <KanbanBoard boardId={boardId} data={board.data} /> : null}
      {/* Pannello di dettaglio della scheda: sotto-rotta, la bacheca resta viva dietro. */}
      <Outlet />
    </>
  );
}
