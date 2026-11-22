import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DeleteBoardDescription } from '@/features/boards/delete-board-description';
import { card } from '@/test/fixtures';
import { mockApi, renderApp, withWorkspace } from '@/test/utils';
import { cardPath, NO_BOARD_LABEL } from './card-path';

/**
 * Opportunità senza bacheca nell'interfaccia (M5-SW.10-a, ADR-0016): percorso del dettaglio, testo di
 * conferma dell'eliminazione di una bacheca, Overview, ricerca globale, Tabella e dettaglio.
 */

const loose = (over: Record<string, unknown> = {}) => ({
  ...card('k9', 'Infermiere libero', 'c1', 1024, { company: 'Orbita' }),
  boardId: null,
  columnId: null,
  boardName: null,
  columnName: null,
  ...over,
});

describe('cardPath', () => {
  it('dalla bacheca se la scheda ne ha una, altrimenti dall’elenco Opportunità', () => {
    expect(cardPath({ id: 'k1', boardId: 'b1' })).toBe('/boards/b1/cards/k1');
    expect(cardPath({ id: 'k1', boardId: null })).toBe('/opportunities/cards/k1');
    expect(cardPath({ id: 'k1', boardId: null }, '#colloqui')).toBe(
      '/opportunities/cards/k1#colloqui',
    );
    expect(cardPath({ id: 'k1', boardId: 'b1' }, '#colloqui')).toBe('/boards/b1/cards/k1#colloqui');
  });
});

describe('conferma di eliminazione di una bacheca', () => {
  it('dichiara che le opportunità NON vengono eliminate e che i campi personalizzati sì', () => {
    render(<DeleteBoardDescription columnCount={4} />);
    expect(
      screen.getByText(/le sue 4 colonne saranno eliminate definitivamente/),
    ).toBeInTheDocument();
    expect(screen.getByText('non vengono eliminate')).toBeInTheDocument();
    expect(screen.getByText(/restano in Opportunità, senza bacheca/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /campi personalizzati di questa bacheca e i valori inseriti nelle sue schede/,
      ),
    ).toBeInTheDocument();
    // Il vecchio testo («tutte le sue schede saranno eliminate») non deve riapparire.
    expect(screen.queryByText(/tutte le sue schede/)).not.toBeInTheDocument();
    expect(screen.getByText('Questa azione non si può annullare.')).toBeInTheDocument();
  });
});

describe('Overview con opportunità senza bacheca', () => {
  it('mostra «Senza bacheca» e apre il dettaglio dall’elenco Opportunità', async () => {
    mockApi(
      withWorkspace({
        workspaceId: 'w1',
        counts: {
          boards: 0,
          opportunities: 2,
          applicationsSubmitted: 0,
          interviews: 0,
          openTasks: 0,
          overdueTasks: 0,
          dueTodayTasks: 0,
          noDueTasks: 0,
        },
        upcomingTasks: [],
        recentBoards: [],
        recentCards: [
          {
            id: 'k9',
            title: 'Infermiere libero',
            boardId: null,
            boardName: null,
            columnName: null,
            updatedAt: 2,
          },
          {
            id: 'k1',
            title: 'Barista part-time',
            boardId: 'b1',
            boardName: 'Ricerca',
            columnName: 'Salvate',
            updatedAt: 1,
          },
        ],
      }),
    );
    renderApp();
    const free = await screen.findByRole('link', { name: /Infermiere libero/ });
    expect(free).toHaveAttribute('href', '/opportunities/cards/k9');
    expect(within(free).getByText(NO_BOARD_LABEL)).toBeInTheDocument();
    const placed = screen.getByRole('link', { name: /Barista part-time/ });
    expect(placed).toHaveAttribute('href', '/boards/b1/cards/k1');
    expect(within(placed).getByText('Ricerca · Salvate')).toBeInTheDocument();
  });
});

describe('ricerca globale con opportunità senza bacheca', () => {
  it('apre il dettaglio e il colloquio dall’elenco Opportunità', async () => {
    mockApi({
      ...withWorkspace(),
      'GET /search': () => ({
        body: {
          opportunities: [
            { id: 'k9', boardId: null, title: 'Libera', subtitle: 'Orbita', archived: false },
          ],
          boards: [],
          interviews: [
            {
              id: 'i9',
              boardId: null,
              cardId: 'k9',
              title: 'Screening libera',
              subtitle: 'Orbita',
            },
          ],
        },
      }),
    });
    const { router } = renderApp();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Cerca in Jobward' }));
    await user.type(await screen.findByRole('combobox'), 'libera');
    await within(await screen.findByRole('group', { name: 'Opportunità' })).findByRole('option', {
      name: /Libera/,
    });
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/opportunities/cards/k9'));
  });
});

describe('Tabella con opportunità senza bacheca', () => {
  it('mostra «Senza bacheca» nelle colonne Bacheca e Colonna e apre il dettaglio sotto la stessa rotta', async () => {
    mockApi({
      ...withWorkspace(),
      'GET /boards': () => ({ body: { boards: [] } }),
      'GET /labels': () => ({ body: { labels: [] } }),
      'GET /opportunities': () => ({
        body: {
          items: [
            loose(),
            { ...card('k1', 'Barista', 'c1', 1024), boardName: 'Ricerca', columnName: 'Salvate' },
          ],
          total: 2,
          page: 1,
          pageSize: 25,
          pageCount: 1,
        },
      }),
    });
    renderApp('/opportunities');
    // La Tabella rende sia la vista desktop sia quella mobile: ogni link compare due volte.
    const links = await screen.findAllByRole('link', { name: 'Infermiere libero' });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute('href', '/opportunities/cards/k9');
    const row = links[0]!.closest('tr') ?? links[0]!.closest('article') ?? links[0]!.closest('li');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText(NO_BOARD_LABEL)).toBeInTheDocument();
    // La scheda in bacheca continua a mostrare il nome della bacheca.
    expect((await screen.findAllByText('Ricerca')).length).toBeGreaterThan(0);
  });
});

describe('dettaglio di un’opportunità senza bacheca', () => {
  it('apre la modale, mostra «Senza bacheca» e non permette di scegliere una colonna', async () => {
    const detail = loose();
    mockApi({
      ...withWorkspace(),
      'GET /boards': () => ({ body: { boards: [] } }),
      'GET /labels': () => ({ body: { labels: [] } }),
      'GET /opportunities': () => ({
        body: { items: [detail], total: 1, page: 1, pageSize: 25, pageCount: 1 },
      }),
      'GET /cards/k9': () => ({ body: { card: detail, history: [] } }),
      'GET /cards/k9/custom-fields': () => ({ body: { fields: [] } }),
      'GET /cards/k9/interviews': () => ({ body: { interviews: [] } }),
      'GET /cards/k9/timeline': () => ({ body: { entries: [], nextCursor: null } }),
    });
    renderApp('/opportunities/cards/k9#dettagli');
    await waitFor(() => expect(document.getElementById('card-column')).not.toBeNull());
    const select = document.getElementById('card-column') as HTMLSelectElement;
    expect(select).toBeDisabled();
    expect(select.value).toBe('');
    expect(within(select).getByRole('option', { name: NO_BOARD_LABEL })).toBeInTheDocument();
  });
});
