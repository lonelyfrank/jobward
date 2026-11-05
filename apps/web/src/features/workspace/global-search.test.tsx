import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mockApi, renderApp, withWorkspace } from '@/test/utils';

const response = {
  opportunities: [
    { id: 'k1', boardId: 'b1', title: 'Tecnico', subtitle: 'Orbita · Milano', archived: false },
  ],
  boards: [{ id: 'b1', title: 'Ricerca', subtitle: 'Milano' }],
  interviews: [
    {
      id: 'i1',
      boardId: 'b1',
      cardId: 'k1',
      title: 'Tecnico reti',
      subtitle: 'Orbita · 2026-11-20',
    },
  ],
};

async function openSearch(body: unknown = response) {
  const calls = mockApi({ ...withWorkspace(), 'GET /search': () => ({ body }) });
  const app = renderApp();
  const user = userEvent.setup();
  const trigger = await screen.findByRole('button', { name: 'Cerca in Jobward' });
  await user.click(trigger);
  const input = await screen.findByRole('combobox');
  return { ...app, user, calls, trigger, input };
}

describe('ricerca globale', () => {
  it('focus iniziale, Esc, ripristino del focus e scorciatoia da un input', async () => {
    const { input, trigger, user } = await openSearch();
    await waitFor(() => expect(input).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    await user.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('combobox')).toHaveFocus();
    await user.keyboard('{Tab}{Tab}');
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('raggruppa risultati, aggiorna la selezione con frecce e apre la risorsa con Invio', async () => {
    const { input, user, router } = await openSearch();
    await user.type(input, 'tecnico');
    const option = await within(
      await screen.findByRole('group', { name: 'Opportunità' }),
    ).findByRole('option', { name: /Tecnico/ });
    expect(option).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('group', { name: 'Bacheche' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Colloqui' })).toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: /Ricerca.*Milano/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByRole('option', { name: /Tecnico reti/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/boards/b1/cards/k1'));
    expect(router.state.location.hash).toBe('#colloqui');
  });

  it('mostra stato vuoto ed errori recuperabili', async () => {
    const { user, input } = await openSearch({ opportunities: [], boards: [], interviews: [] });
    await user.type(input, 'assente');
    expect(await screen.findByText('Nessun risultato per “assente”.')).toBeInTheDocument();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'forbidden', message: 'x' } }), { status: 403 }),
    );
    await user.clear(input);
    await user.type(input, 'errore');
    expect(await screen.findByRole('alert')).toHaveTextContent('Non riusciamo a cercare');
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeEnabled();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('attende il debounce, nasconde risultati obsoleti e annulla la richiesta quando si chiude', async () => {
    const { user, input, calls } = await openSearch();
    await user.type(input, 'tecnico');
    expect(calls.filter((call) => call.path.startsWith('/search'))).toHaveLength(0);
    await within(await screen.findByRole('group', { name: 'Opportunità' })).findByRole('option', {
      name: /Tecnico/,
    });
    let signal: AbortSignal | null | undefined;
    vi.mocked(fetch).mockImplementation((_input, init) => {
      signal = init?.signal;
      return new Promise(() => {});
    });
    await user.type(input, ' reti');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    await waitFor(() => expect(signal).toBeDefined());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(signal?.aborted).toBe(true));
    await act(async () => Promise.resolve());
  });

  it('menu Overview, separatori, creazione; nessun menu vuoto nelle viste future', async () => {
    mockApi(withWorkspace());
    const user = userEvent.setup();
    const { router } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'Azioni della vista' }));
    const menu = await screen.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Nuova scheda', 'Le mie bacheche']);
    expect(within(menu).getByRole('separator')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await act(() => router.navigate('/tasks'));
    expect(await screen.findByRole('heading', { name: 'Attività', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Azioni della vista' })).not.toBeInTheDocument();
  });
});
