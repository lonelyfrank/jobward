import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as dataProfile from '@/lib/data-profile';
import { readDataProfile, restartApp } from '@/lib/data-profile';
import { mockApi, renderApp, USER, WORKSPACE, withWorkspace } from '@/test/utils';

vi.mock('@/lib/data-profile', async (importOriginal) => ({
  ...(await importOriginal<typeof dataProfile>()),
  restartApp: vi.fn(),
}));
const restart = vi.mocked(restartApp);

const me = (active: 'real' | 'demo', workspaces: unknown[] = [WORKSPACE]) => ({
  body: { user: USER, workspaces, profile: { available: true, active } },
});

afterEach(() => {
  window.localStorage.clear();
  restart.mockClear();
});

describe('Impostazioni → Dati demo', () => {
  it('non compare se il server non offre il profilo demo (es. Cloudflare Access)', async () => {
    mockApi({ ...withWorkspace(), 'GET /labels': () => ({ body: { labels: [] } }) });
    renderApp('/settings');
    expect(await screen.findByRole('heading', { name: 'Impostazioni' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dati demo' })).not.toBeInTheDocument();
  });

  it('passando alla demo la popola se vuota, invia l’header e ricarica l’app', async () => {
    let demoActive = false;
    const calls = mockApi({
      ...withWorkspace(),
      'GET /labels': () => ({ body: { labels: [] } }),
      'GET /me': () => (demoActive ? me('demo', []) : me('real')),
      'POST /demo/reset': () => ({ status: 201, body: { workspace: WORKSPACE } }),
    });
    const fetchMock = vi.mocked(globalThis.fetch);
    renderApp('/settings');
    const user = userEvent.setup();
    const demo = await screen.findByRole('button', { name: 'Dati demo' });
    expect(screen.getByRole('button', { name: 'I miei dati' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    demoActive = true;
    await user.click(demo);
    await waitFor(() => expect(restart).toHaveBeenCalled());
    expect(readDataProfile()).toBe('demo');
    expect(calls.some((c) => c.method === 'POST' && c.path === '/demo/reset')).toBe(true);
    const lastInit = fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
    expect((lastInit.headers as Record<string, string>)['x-jobward-profile']).toBe('demo');
  });

  it('se la preparazione fallisce torna ai dati reali e lo dice', async () => {
    let demoActive = false;
    mockApi({
      ...withWorkspace(),
      'GET /labels': () => ({ body: { labels: [] } }),
      'GET /me': () => (demoActive ? me('demo', []) : me('real')),
      'POST /demo/reset': () => ({ status: 500, body: {} }),
    });
    renderApp('/settings');
    const user = userEvent.setup();
    const demo = await screen.findByRole('button', { name: 'Dati demo' });
    demoActive = true;
    await user.click(demo);
    expect(await screen.findByRole('alert')).toHaveTextContent('preparare i dati demo');
    expect(readDataProfile()).toBe('real');
    expect(restart).not.toHaveBeenCalled();
  });

  it('nella demo offre la rigenerazione con conferma', async () => {
    window.localStorage.setItem('jobward.data-profile.v1', 'demo');
    const calls = mockApi({
      ...withWorkspace(),
      'GET /labels': () => ({ body: { labels: [] } }),
      'GET /me': () => me('demo'),
      'POST /demo/reset': () => ({ status: 201, body: { workspace: WORKSPACE } }),
    });
    renderApp('/settings');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Rigenera dati demo/ }));
    await user.click(await screen.findByRole('button', { name: 'Rigenera' }));
    await waitFor(() => expect(restart).toHaveBeenCalled());
    expect(calls.filter((c) => c.path === '/demo/reset')).toHaveLength(1);
  });
});
