import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { boardDetail, card, column } from '@/test/fixtures';
import { mockApi, renderApp, withWorkspace } from '@/test/utils';

/**
 * Salvataggio unico della modale: le modifiche fatte in schede diverse (Organizzazione nel pannello
 * di stato, Dettagli) restano in bozza e partono tutte insieme con un solo «Salva», inviando SOLO
 * ciò che è cambiato.
 */
function server() {
  let current = card('k1', 'Barista', 'c1', 1024, { company: 'Orbita', labelIds: [] });
  const detail = {
    ...boardDetail(),
    columns: [
      column('c1', 'Salvate', 1024, { cardCount: 1 }),
      column('c2', 'Inviate', 2048, { cardCount: 0 }),
    ],
    cards: [current],
  };
  const calls = mockApi({
    ...withWorkspace(),
    'GET /boards': () => ({ body: { boards: [] } }),
    'GET /boards/b1': () => ({ body: detail }),
    'GET /cards/k1': () => ({ body: { card: current, history: [] } }),
    'GET /cards/k1/custom-fields': () => ({ body: { fields: [] } }),
    'GET /cards/k1/interviews': () => ({ body: { interviews: [] } }),
    'GET /labels': () => ({
      body: { labels: [{ id: 'l1', name: 'Estero', color: 'teal', cardCount: 0, createdAt: 1 }] },
    }),
    'PATCH /cards/k1': ({ body }) => {
      current = { ...current, ...(body as object) };
      return { body: { card: current } };
    },
    'POST /cards/k1/move': ({ body }) => {
      current = { ...current, columnId: (body as { columnId: string }).columnId };
      return { body: { card: current } };
    },
    'POST /cards/k1/labels': ({ body }) => {
      current = { ...current, labelIds: [(body as { labelId: string }).labelId] };
      return { body: { labelIds: current.labelIds } };
    },
  });
  return calls;
}

describe('modale: salvataggio unico', () => {
  it('colonna, priorità, etichette e dettagli si salvano tutti con un solo «Salva»', async () => {
    const user = userEvent.setup();
    const calls = server();
    renderApp('/boards/b1/cards/k1');

    // Organizzazione: nulla parte finché non si salva.
    const columnSelect = await screen.findByLabelText('Colonna');
    await user.selectOptions(columnSelect, 'c2');
    await user.selectOptions(screen.getByLabelText('Priorità'), 'high');
    await user.click(screen.getByRole('button', { name: /aggiungi etichetta/i }));
    await user.click(await screen.findByRole('checkbox', { name: /Estero/ }));
    expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);

    // Dettagli: si entra in modifica e si cambia la sede.
    await user.click(screen.getByRole('tab', { name: 'Dettagli' }));
    await user.click(screen.getByRole('button', { name: 'Modifica' }));
    await user.type(screen.getByLabelText('Sede'), 'Torino');

    const bar = screen.getByRole('region', { name: 'Modifiche da salvare' });
    expect(within(bar).getByRole('status')).toHaveTextContent('4 modifiche non salvate');
    // La bozza resta passando a un'altra scheda; la barra è sempre lì.
    await user.click(screen.getByRole('tab', { name: 'Panoramica' }));
    await user.click(within(bar).getByRole('button', { name: 'Salva' }));

    await screen.findByText('Modifiche salvate.');
    const writes = calls.filter((c) => c.method !== 'GET');
    expect(writes.map((c) => `${c.method} ${c.path.split('?')[0]}`)).toEqual([
      'PATCH /cards/k1',
      'POST /cards/k1/move',
      'POST /cards/k1/labels',
    ]);
    // Solo i campi cambiati.
    expect(writes[0]?.body).toEqual({ priority: 'high', location: 'Torino' });
    expect(writes[1]?.body).toMatchObject({ columnId: 'c2' });
    expect(writes[2]?.body).toEqual({ labelId: 'l1' });
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Modifiche da salvare' })).toBeNull(),
    );
  });

  it('«Annulla» scarta tutta la bozza senza scrivere nulla', async () => {
    const user = userEvent.setup();
    const calls = server();
    renderApp('/boards/b1/cards/k1');
    await user.selectOptions(await screen.findByLabelText('Priorità'), 'low');
    const bar = screen.getByRole('region', { name: 'Modifiche da salvare' });
    await user.click(within(bar).getByRole('button', { name: 'Annulla modifiche' }));
    expect(screen.getByLabelText('Priorità')).toHaveValue('none');
    expect(screen.queryByRole('region', { name: 'Modifiche da salvare' })).toBeNull();
    expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });
});
