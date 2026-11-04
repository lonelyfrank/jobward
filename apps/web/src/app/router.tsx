import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';
import { WorkspaceGate } from '@/features/workspace/workspace-gate';
import { AppShell } from '@/layouts/app-shell';
import type { RouteHandle } from '@/layouts/nav';
import { BoardPlaceholderPage, BoardsPage } from '@/routes/boards';
import { InsightsPage, OpportunitiesPage, TasksPage } from '@/routes/coming-soon';
import { NotFoundPage } from '@/routes/not-found';
import { OverviewPage } from '@/routes/overview';
import { SettingsPage } from '@/routes/settings';

const handle = (title: string): RouteHandle => ({ title });

export const appRoutes: RouteObject[] = [
  {
    element: <WorkspaceGate />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <OverviewPage />, handle: handle('Overview') },
          { path: 'boards', element: <BoardsPage />, handle: handle('Bacheche') },
          { path: 'boards/:boardId', element: <BoardPlaceholderPage />, handle: handle('Bacheca') },
          { path: 'opportunities', element: <OpportunitiesPage />, handle: handle('Opportunità') },
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
