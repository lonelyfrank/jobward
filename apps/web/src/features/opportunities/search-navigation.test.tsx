import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mockApi, renderApp, withWorkspace } from '@/test/utils';

describe('ricerca: URL e stato ottimistico', () => {
  it('il debounce conserva un filtro scelto durante la digitazione', async () => {
    mockApi({
      ...withWorkspace(),
      'GET /boards': () => ({ body: { boards: [] } }),
      'GET /labels': () => ({ body: { labels: [] } }),
      'GET /opportunities': () => ({
        body: { items: [], total: 0, page: 1, pageSize: 25, pageCount: 0 },
      }),
    });
    const { router } = renderApp('/opportunities?priority=high');
    const input = await screen.findByRole('searchbox');
    await screen.findByText('0 risultati');
    vi.useFakeTimers();
    try {
      fireEvent.change(input, { target: { value: 'acme' } });
      fireEvent.click(screen.getByRole('checkbox', { name: /^Salvata$/ }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(router.state.location.search).toContain('q=acme');
      expect(new URLSearchParams(router.state.location.search).get('stage')).toBe('saved');
      expect(screen.getByRole('checkbox', { name: /^Salvata$/ })).toBeChecked();
    } finally {
      vi.useRealTimers();
    }
  });

  it('una risposta superata non sovrascrive la ricerca più recente', async () => {
    let release!: (value: { body: unknown }) => void;
    mockApi({
      ...withWorkspace(),
      'GET /boards': () => ({ body: { boards: [] } }),
      'GET /labels': () => ({ body: { labels: [] } }),
      'GET /opportunities': ({ path }) => {
        if (new URL(path, 'http://localhost').searchParams.get('q') === 'prima') {
          return new Promise((resolve) => {
            release = resolve;
          });
        }
        return { body: { items: [], total: 2, page: 1, pageSize: 25, pageCount: 1 } };
      },
    });
    const { router } = renderApp('/opportunities?q=prima');
    await waitFor(() => expect(release).toBeTypeOf('function'));
    const firstSignal = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => typeof url === 'string' && url.includes('q=prima'))?.[1]?.signal;
    await act(() => router.navigate('/opportunities?q=seconda'));
    await screen.findByText('2 risultati');
    expect(firstSignal?.aborted).toBe(true);
    await act(async () => {
      release({ body: { items: [], total: 0, page: 1, pageSize: 25, pageCount: 0 } });
      await Promise.resolve(); // completa la risposta differita prima di verificare il risultato
    });
    expect(screen.getByText('2 risultati')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('seconda');
  });

  it('Indietro ripristina i filtri e i risultati anche quando una risposta arriva prima del commit URL', async () => {
    mockApi({
      ...withWorkspace(),
      'GET /boards': () => ({ body: { boards: [] } }),
      'GET /labels': () => ({ body: { labels: [] } }),
      'GET /opportunities': ({ path }) => {
        const query = new URL(path, 'http://localhost').searchParams;
        return {
          body: {
            items: [],
            total: query.has('stage') ? 0 : 2,
            page: 1,
            pageSize: 25,
            pageCount: query.has('stage') ? 0 : 1,
          },
        };
      },
    });
    const { router } = renderApp('/opportunities?priority=high');
    const user = userEvent.setup();
    await screen.findByText('2 risultati');
    await user.click(screen.getByRole('checkbox', { name: /^Salvata$/ }));
    await screen.findByText('0 risultati');
    await waitFor(() => expect(router.state.location.search).toContain('stage=saved'));
    await act(() => router.navigate(-1));
    await waitFor(() => expect(router.state.location.search).not.toContain('stage='));
    await screen.findByText('2 risultati');
    expect(screen.getByRole('checkbox', { name: /^Salvata$/ })).not.toBeChecked();
  });
});
