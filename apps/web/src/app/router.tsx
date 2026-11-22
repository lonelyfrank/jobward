import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';
import { WorkspaceGate } from '@/features/workspace/workspace-gate';
import { AppShell } from '@/layouts/app-shell';
import type { RouteHandle } from '@/layouts/nav';
import { CardDetailRoute } from '@/features/cards/card-detail-route';
import { BoardPage } from '@/routes/board';
import { BoardsPage } from '@/routes/boards';
import { NotFoundPage } from '@/routes/not-found';
import { OverviewPage } from '@/routes/overview';
import { SettingsPage } from '@/routes/settings';
import { ProfilePage } from '@/routes/profile';
import { HelpPage } from '@/routes/help';

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
          {
            index: true,
            element: <OverviewPage />,
            handle: handle('Overview', { fullBleed: true }),
          },
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
            path: 'pipeline',
            lazy: () => import('@/routes/pipeline'),
            handle: handle('Pipeline'),
            children: [{ path: 'cards/:cardId', element: <CardDetailRoute /> }],
          },
          {
            path: 'opportunities',
            lazy: () => import('@/routes/opportunities'),
            handle: handle('Opportunità'),
            children: [{ path: 'cards/:cardId', element: <CardDetailRoute /> }],
          },
          {
            path: 'companies',
            lazy: () => import('@/routes/companies'),
            handle: handle('Aziende'),
          },
          {
            path: 'companies/:companyId',
            lazy: () => import('@/routes/company'),
            handle: handle('Azienda'),
          },
          { path: 'tasks', lazy: () => import('@/routes/tasks'), handle: handle('Attività') },
          {
            path: 'calendar',
            lazy: () => import('@/routes/calendar'),
            handle: handle('Calendario', { fullBleed: true }),
          },
          {
            path: 'insights',
            lazy: () => import('@/routes/insights'),
            handle: handle('Insights', { fullBleed: true }),
          },
          { path: 'settings', element: <SettingsPage />, handle: handle('Impostazioni') },
          { path: 'profile', element: <ProfilePage />, handle: handle('Profilo') },
          { path: 'help', element: <HelpPage />, handle: handle('Aiuto') },
          { path: '*', element: <NotFoundPage />, handle: handle('Pagina non trovata') },
        ],
      },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(appRoutes);
export const createTestRouter = (initialEntries: string[] = ['/']) =>
  createMemoryRouter(appRoutes, { initialEntries });
