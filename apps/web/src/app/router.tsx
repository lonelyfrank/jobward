import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';
import { WorkspaceGate } from '@/features/workspace/workspace-gate';
import { AppShell } from '@/layouts/app-shell';
import type { RouteHandle } from '@/layouts/nav';
import { CardDetailRoute } from '@/features/cards/card-detail-route';
import { BoardPage } from '@/routes/board';
import { BoardsPage } from '@/routes/boards';
import { InsightsPage, TasksPage } from '@/routes/coming-soon';
import { NotFoundPage } from '@/routes/not-found';
import { OverviewPage } from '@/routes/overview';
import { SettingsPage } from '@/routes/settings';

const handle = (title: string, extra: Partial<RouteHandle> = {}): RouteHandle => ({
  title,
  ...extra,
});

export const appRoutes: RouteObject[] = [
  {
    element: <WorkspaceGate />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <OverviewPage />, handle: handle('Overview') },
          { path: 'boards', element: <BoardsPage />, handle: handle('Bacheche') },
          {
            path: 'boards/:boardId',
            element: <BoardPage />,
            // La bacheca usa tutta l'area disponibile (scorrimento orizzontale delle colonne).
            handle: handle('Bacheca', { fullBleed: true }),
            // Kanban e Tabella sono due viste degli stessi dati; il pannello di dettaglio è una
            // sotto-rotta di ciascuna. Le viste pesanti si caricano a richiesta (code splitting).
            children: [
              {
                // Percorso vuoto: il Kanban è la vista predefinita ma ammette la sotto-rotta del pannello.
                lazy: () => import('@/routes/board-kanban'),
                children: [
                  { index: true, element: <></> },
                  { path: 'cards/:cardId', element: <CardDetailRoute /> },
                ],
              },
              {
                path: 'table',
                lazy: () => import('@/routes/board-table'),
                children: [{ path: 'cards/:cardId', element: <CardDetailRoute /> }],
              },
            ],
          },
          {
            path: 'opportunities',
            lazy: () => import('@/routes/opportunities'),
            handle: handle('Opportunità'),
            children: [{ path: 'cards/:cardId', element: <CardDetailRoute /> }],
          },
          { path: 'tasks', element: <TasksPage />, handle: handle('Attività') },
          { path: 'insights', element: <InsightsPage />, handle: handle('Insights') },
          { path: 'settings', element: <SettingsPage />, handle: handle('Impostazioni') },
          { path: '*', element: <NotFoundPage />, handle: handle('Pagina non trovata') },
        ],
      },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(appRoutes);
export const createTestRouter = (initialEntries: string[] = ['/']) =>
  createMemoryRouter(appRoutes, { initialEntries });
