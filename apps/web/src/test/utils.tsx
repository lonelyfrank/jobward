import { render } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { createQueryClient, Providers } from '@/app/providers';
import { createTestRouter } from '@/app/router';

export const USER = { id: 'u1', email: 'persona@example.com' };
export const WORKSPACE = {
  id: 'w1',
  name: 'La mia ricerca',
  timezone: 'Europe/Rome',
  role: 'owner' as const,
  createdAt: 1_700_000_000_000,
};
export const EMPTY_OVERVIEW = {
  workspaceId: 'w1',
  counts: {
    boards: 0,
    opportunities: 0,
    applicationsSubmitted: 0,
    interviews: 0,
    openTasks: 0,
    overdueTasks: 0,
  },
  upcomingTasks: [],
  recentBoards: [],
};

type Handler = (req: { method: string; body: unknown }) => { status?: number; body: unknown };

/** Sostituisce fetch con un'API simulata a livello di rete. Restituisce le chiamate ricevute. */
export function mockApi(routes: Record<string, Handler>) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      const path = String(input).replace('/api/v1', '');
      const method = init?.method ?? 'GET';
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ method, path, body });
      const handler = routes[`${method} ${path.split('?')[0]}`];
      if (!handler)
        return Promise.resolve(
          new Response(
            JSON.stringify({ error: { code: 'not_found', message: 'x', requestId: 'r' } }),
            { status: 404 },
          ),
        );
      const { status = 200, body: payload } = handler({ method, body });
      return Promise.resolve(
        new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }),
  );
  return calls;
}

export const withWorkspace = (overview: unknown = EMPTY_OVERVIEW): Record<string, Handler> => ({
  'GET /me': () => ({ body: { user: USER, workspaces: [WORKSPACE] } }),
  'GET /overview': () => ({ body: overview }),
});

export function renderApp(path = '/') {
  const router = createTestRouter([path]);
  const utils = render(
    <Providers client={createQueryClient({ retryDelay: 0 })}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { router, ...utils };
}
