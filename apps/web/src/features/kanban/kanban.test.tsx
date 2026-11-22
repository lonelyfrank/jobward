import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { applyCardMove, applyColumnMove } from '@/features/kanban/board-state';
import { board as boardItem, boardDetail, card, column } from '@/test/fixtures';
import { mockApi, renderApp, withWorkspace } from '@/test/utils';

const detail = () => boardDetail();

/**
 * Server simulato con stato: gli spostamenti applicati restano visibili alle riletture, come
 * farebbe il database. Senza stato, il ricaricamento che segue ogni mutazione ripristinerebbe i dati iniziali.
 */
function statefulBoard() {
  let state = detail();
  return {
    get: () => state,
    set: (next: ReturnType<typeof detail>) => (state = next),
    handlers: {
      'GET /boards/b1': () => ({ body: state }),
      'POST /cards/k1/move': ({ body }: { body: unknown }) => {
        const m = body as { columnId: string; afterCardId: string | null };
        state = applyCardMove(state, { cardId: 'k1', ...m }) ?? state;
        return { body: { card: state.cards.find((c) => c.id === 'k1') } };
      },
      'POST /cards/k2/move': ({ body }: { body: unknown }) => {
        const m = body as { columnId: string; afterCardId: string | null };
        state = applyCardMove(state, { cardId: 'k2', ...m }) ?? state;
        return { body: { card: state.cards.find((c) => c.id === 'k2') } };
      },
      'POST /columns/c1/move': ({ body }: { body: unknown }) => {
        state =
          applyColumnMove(state, {
            columnId: 'c1',
            afterColumnId: (body as { afterId: string | null }).afterId,
          }) ?? state;
        return { body: { column: state.columns.find((c) => c.id === 'c1') } };
      },
    },
  };
}
const err = (status: number, code: string, message: string) => ({
  status,
  body: { error: { code, message, requestId: 'r' } },
});

const listOf = (name: string) => screen.getByRole('list', { name: `Schede in ${name}` });
const titlesIn = (name: string) =>
  within(listOf(name))
    .queryAllByRole('listitem')
    .map((li) => within(li).getByRole('link').textContent);

describe('Galleria bacheche', () => {
  it('mostra le bacheche con conteggi reali; le preferite sono in evidenza', async () => {
    mockApi({
      ...withWorkspace(),
      'GET /boards': () => ({
        body: {
          boards: [
            boardItem({ id: 'b1', name: 'Estate', cardCount: 1, columnCount: 3 }),
            boardItem({
              id: 'b2',
              name: 'Autunno',
              isFavorite: true,
              cardCount: 5,
              columnCount: 6,
            }),
          ],
        },
      }),
    });
    renderApp('/boards');

    const favorites = await screen.findByRole('region', { name: 'Preferite' });
    expect(within(favorites).getByRole('link', { name: 'Autunno' })).toHaveAttribute(
      'href',
      '/boards/b2',
    );
    expect(within(favorites).getByText('6 colonne · 5 schede')).toBeInTheDocument();
    const all = screen.getByRole('region', { name: 'Tutte le bacheche' });
    expect(within(all).getByText('3 colonne · 1 scheda')).toBeInTheDocument();
  });

  it('crea una bacheca da template e apre la bacheca creata', async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...withWorkspace(),
      'GET /boards': () => ({ body: { boards: [] } }),
      'POST /boards': () => ({
        status: 201,
        body: { board: { ...boardDetail().board, id: 'nuova' }, columns: [] },
      }),
      'GET /boards/nuova': () => ({
        body: { ...detail(), board: { ...detail().board, id: 'nuova' } },
      }),
    });
    const { router } = renderApp('/boards');

    await user.click(await screen.findByRole('button', { name: 'Azioni della vista' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Nuova bacheca' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuova bacheca' });
    await user.type(within(dialog).getByLabelText('Nome'), 'Ricerca 2027');
    await user.click(within(dialog).getByRole('radio', { name: /Minimal/ }));
    await user.click(within(dialog).getByRole('radio', { name: 'Blu' }));
    await user.click(within(dialog).getByRole('button', { name: 'Crea bacheca' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/boards/nuova'));
    const post = calls.find((c) => c.method === 'POST' && c.path.startsWith('/boards'));
    expect(post?.body).toMatchObject({
      name: 'Ricerca 2027',
      templateId: 'minimal',
      color: 'blue',
    });
    expect(post?.path).toContain('workspaceId=w1');
  });

  it('il template predefinito è Job Search Standard e il nome è obbligatorio (nessuna richiesta)', async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...withWorkspace(), 'GET /boards': () => ({ body: { boards: [] } }) });
    renderApp('/boards');

    await user.click(await screen.findByRole('button', { name: 'Azioni della vista' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Nuova bacheca' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuova bacheca' });
    expect(within(dialog).getByRole('radio', { name: /Job Search Standard/ })).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Crea bacheca' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Campo obbligatorio');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('elimina solo dopo conferma e spiega cosa verrà perso', async () => {
    const user = userEvent.setup();
    let boards = [boardItem({ id: 'b1', name: 'Da eliminare', columnCount: 4, cardCount: 7 })];
    const calls = mockApi({
      ...withWorkspace(),
      'GET /boards': () => ({ body: { boards } }),
      'DELETE /boards/b1': () => {
        boards = [];
        return { body: { id: 'b1' } };
      },
    });
    renderApp('/boards');

    await user.click(await screen.findByRole('button', { name: 'Azioni per “Da eliminare”' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Elimina…' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('4 colonne');
    expect(confirm).toHaveTextContent('non si può annullare');

    // Annullare non elimina nulla.
    await user.click(within(confirm).getByRole('button', { name: 'Annulla' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    await user.click(await screen.findByRole('button', { name: 'Azioni per “Da eliminare”' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Elimina…' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Elimina bacheca',
      }),
    );

    expect(await screen.findByText('Non hai ancora bacheche')).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
  });

  it('il riordino da menu applica subito il nuovo ordine e, se il server rifiuta, lo ripristina', async () => {
    const user = userEvent.setup();
    const boards = [
      boardItem({ id: 'b1', name: 'Prima', position: 1024 }),
      boardItem({ id: 'b2', name: 'Seconda', position: 2048 }),
    ];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const calls = mockApi({
      ...withWorkspace(),
      'GET /boards': () => ({ body: { boards } }),
      'POST /boards/b2/move': async () => {
        await gate;
        return err(409, 'conflict', 'L’elenco delle bacheche è cambiata nel frattempo');
      },
    });
    renderApp('/boards');

    const names = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(await screen.findByRole('link', { name: 'Seconda' })).toBeInTheDocument();
    expect(names()).toEqual(['Prima', 'Seconda']);

    await user.click(screen.getByRole('button', { name: 'Azioni per “Seconda”' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sposta su' }));
    // Ottimistico: l'ordine cambia prima della risposta del server.
    await waitFor(() => expect(names()).toEqual(['Seconda', 'Prima']));
    expect(calls.find((c) => c.path.includes('/boards/b2/move'))?.body).toEqual({ afterId: null });

    release();
    // Rollback + avviso.
    await waitFor(() => expect(names()).toEqual(['Prima', 'Seconda']));
    expect(await screen.findByRole('alert')).toHaveTextContent('ripristinato');
  });
});

describe('Bacheca aperta', () => {
  const api = (extra: Parameters<typeof mockApi>[0] = {}) =>
    mockApi({ ...withWorkspace(), 'GET /boards/b1': () => ({ body: detail() }), ...extra });

  it('mostra colonne, contatori e schede (priorità e azienda inclusi)', async () => {
    api();
    renderApp('/boards/b1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ricerca autunno' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Offerte di lavoro per l’autunno')).toBeInTheDocument();

    const columns = screen.getAllByRole('region').filter((r) => r.hasAttribute('data-column-id'));
    expect(columns.map((c) => within(c).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Salvate',
      'Inviate',
      'Colloquio',
    ]);
    expect(titlesIn('Salvate')).toEqual(['Barista part-time', 'Magazziniere']);
    expect(within(columns[0]!).getByLabelText('2 schede')).toBeInTheDocument();
    expect(screen.getByText('Caffè Roma')).toBeInTheDocument();
    expect(screen.getByText('Priorità alta')).toBeInTheDocument();
    expect(within(columns[1]!).getByText('Nessuna scheda in questa colonna.')).toBeInTheDocument();
  });

  it('una bacheca inesistente (o di un altro workspace) mostra "non trovata" senza dettagli', async () => {
    mockApi({
      ...withWorkspace(),
      'GET /boards/zzz': () => err(404, 'not_found', 'Bacheca non trovata'),
    });
    renderApp('/boards/zzz');
    expect(await screen.findByRole('heading', { name: 'Bacheca non trovata' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tutte le bacheche' })).toBeInTheDocument();
  });

  describe('creazione rapida', () => {
    it('basta il titolo; Invio aggiunge la scheda e il campo resta pronto per la successiva', async () => {
      const user = userEvent.setup();
      let n = 0;
      const calls = api({
        'POST /cards': ({ body }) => {
          const { title, columnId } = body as { title: string; columnId: string };
          return {
            status: 201,
            body: { card: card(`n${++n}`, title, columnId, 3000 + n) },
          };
        },
      });
      renderApp('/boards/b1');

      const col = await screen.findByRole('region', { name: 'Inviate' });
      await user.click(within(col).getByRole('button', { name: /Aggiungi scheda/ }));
      const input = within(col).getByLabelText('Titolo della nuova scheda in Inviate');
      expect(input).toHaveFocus();

      await user.type(input, 'Cuoco{Enter}');
      await waitFor(() => expect(titlesIn('Inviate')).toEqual(['Cuoco']));
      expect(input).toHaveFocus();
      expect(input).toHaveValue('');
      await user.type(input, 'Cameriere{Enter}');
      await waitFor(() => expect(titlesIn('Inviate')).toEqual(['Cuoco', 'Cameriere']));

      const posts = calls.filter((c) => c.method === 'POST');
      expect(posts.map((p) => p.body)).toEqual([
        { columnId: 'c2', title: 'Cuoco' },
        { columnId: 'c2', title: 'Cameriere' },
      ]);
      expect(within(col).getByLabelText('2 schede')).toBeInTheDocument();
    });

    it('titolo vuoto: errore annunciato, nessuna richiesta; Esc chiude e riporta il focus', async () => {
      const user = userEvent.setup();
      const calls = api();
      renderApp('/boards/b1');

      const col = await screen.findByRole('region', { name: 'Inviate' });
      const open = within(col).getByRole('button', { name: /Aggiungi scheda/ });
      await user.click(open);
      await user.type(within(col).getByLabelText(/Titolo della nuova scheda/), '   {Enter}');
      expect(await within(col).findByRole('alert')).toHaveTextContent('Scrivi un titolo');
      expect(calls.some((c) => c.method === 'POST')).toBe(false);

      await user.keyboard('{Escape}');
      expect(await within(col).findByRole('button', { name: /Aggiungi scheda/ })).toHaveFocus();
    });

    it('se il server rifiuta, mostra il messaggio e conserva il testo digitato', async () => {
      const user = userEvent.setup();
      api({
        'POST /cards': () =>
          err(409, 'conflict', 'Una bacheca può contenere al massimo 2000 schede'),
      });
      renderApp('/boards/b1');

      const col = await screen.findByRole('region', { name: 'Inviate' });
      await user.click(within(col).getByRole('button', { name: /Aggiungi scheda/ }));
      const input = within(col).getByLabelText(/Titolo della nuova scheda/);
      await user.type(input, 'Cuoco{Enter}');
      expect(await within(col).findByRole('alert')).toHaveTextContent('al massimo 2000 schede');
      expect(input).toHaveValue('Cuoco');
    });
  });

  describe('spostamento da menu (alternativa al trascinamento)', () => {
    const openMenu = async (user: ReturnType<typeof userEvent.setup>, title: string) =>
      user.click(await screen.findByRole('button', { name: `Azioni per la scheda “${title}”` }));

    it('"Sposta in" mette la scheda in fondo alla colonna scelta, subito (ottimistico)', async () => {
      const user = userEvent.setup();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const server = statefulBoard();
      const calls = api({
        ...server.handlers,
        'POST /cards/k1/move': async (req) => {
          await gate;
          return server.handlers['POST /cards/k1/move'](req);
        },
      });
      renderApp('/boards/b1');

      await openMenu(user, 'Barista part-time');
      await user.click(await screen.findByRole('menuitem', { name: 'Colloquio' }));

      await waitFor(() => expect(titlesIn('Colloquio')).toEqual(['Barista part-time']));
      expect(titlesIn('Salvate')).toEqual(['Magazziniere']);
      expect(
        screen.getByRole('region', { name: 'Colloquio' }).querySelector('[aria-label$="scheda"]'),
      ).not.toBeNull();
      expect(calls.find((c) => c.path.startsWith('/cards/k1/move'))?.body).toEqual({
        columnId: 'c3',
        afterCardId: null,
      });
      release();
      // Dopo la conferma del server lo stato resta quello ottimistico (riletto dal "database").
      await waitFor(() => expect(titlesIn('Colloquio')).toEqual(['Barista part-time']));
    });

    it('riordina con "Sposta giù"/"Sposta su" calcolando il vicino corretto', async () => {
      const user = userEvent.setup();
      const calls = api(statefulBoard().handlers);
      renderApp('/boards/b1');

      await openMenu(user, 'Barista part-time');
      expect(await screen.findByRole('menuitem', { name: 'Sposta su' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      await user.click(screen.getByRole('menuitem', { name: 'Sposta giù' }));
      await waitFor(() =>
        expect(titlesIn('Salvate')).toEqual(['Magazziniere', 'Barista part-time']),
      );
      expect(calls.find((c) => c.path.startsWith('/cards/k1/move'))?.body).toEqual({
        columnId: 'c1',
        afterCardId: 'k2',
      });
    });

    it('errore di persistenza: la scheda torna dov’era e l’utente viene avvisato (rollback)', async () => {
      const user = userEvent.setup();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      api({
        'POST /cards/k1/move': async () => {
          await gate;
          return err(500, 'internal_error', 'Errore');
        },
      });
      renderApp('/boards/b1');

      await openMenu(user, 'Barista part-time');
      await user.click(await screen.findByRole('menuitem', { name: 'Inviate' }));
      await waitFor(() => expect(titlesIn('Inviate')).toEqual(['Barista part-time']));

      release();
      await waitFor(() =>
        expect(titlesIn('Salvate')).toEqual(['Barista part-time', 'Magazziniere']),
      );
      expect(titlesIn('Inviate')).toEqual([]);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'tornata nella posizione originale',
      );
    });

    it('un conflitto (409) mostra il messaggio del server e ripristina', async () => {
      const user = userEvent.setup();
      api({
        'POST /cards/k2/move': () =>
          err(
            409,
            'conflict',
            'La scheda è stata spostata o archiviata nel frattempo: aggiorna la pagina',
          ),
      });
      renderApp('/boards/b1');
      await openMenu(user, 'Magazziniere');
      await user.click(await screen.findByRole('menuitem', { name: 'Sposta su' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'spostata o archiviata nel frattempo',
      );
      await waitFor(() =>
        expect(titlesIn('Salvate')).toEqual(['Barista part-time', 'Magazziniere']),
      );
    });
  });

  describe('archiviazione', () => {
    it('archivia dal menu: la scheda sparisce, il contatore scende, l’annuncio è dato', async () => {
      const user = userEvent.setup();
      const server = statefulBoard();
      const calls = api({
        ...server.handlers,
        'POST /cards/k2/archive': () => ({
          body: { card: card('k2', 'Magazziniere', 'c1', 2048, { archivedAt: 5 }) },
        }),
      });
      renderApp('/boards/b1');
      await user.click(
        await screen.findByRole('button', { name: 'Azioni per la scheda “Magazziniere”' }),
      );
      await user.click(await screen.findByRole('menuitem', { name: 'Archivia' }));

      await waitFor(() => expect(titlesIn('Salvate')).toEqual(['Barista part-time']));
      expect(await screen.findByText(/Scheda “Magazziniere” archiviata/)).toBeInTheDocument();
      expect(calls.some((c) => c.path.startsWith('/cards/k2/archive'))).toBe(true);
      await user.click(screen.getByRole('button', { name: 'Azioni della vista' }));
      expect(await screen.findByRole('menuitem', { name: /Archiviate/ })).toHaveTextContent('1');
    });

    it('le schede archiviate si vedono e si ripristinano dal pannello', async () => {
      const user = userEvent.setup();
      const archived = card('k9', 'Vecchia offerta', 'c1', 4096, { archivedAt: 1_700_000_100_000 });
      const base = detail();
      base.columns[0] = { ...base.columns[0]!, archivedCount: 1 };
      let restored = false;
      const calls = api({
        'GET /boards/b1': () => ({ body: base }),
        'GET /boards/b1/archived': () => ({ body: { cards: restored ? [] : [archived] } }),
        'POST /cards/k9/restore': () => {
          restored = true;
          return { body: { card: { ...archived, archivedAt: null } } };
        },
      });
      renderApp('/boards/b1');

      await user.click(await screen.findByRole('button', { name: 'Azioni della vista' }));
      await user.click(await screen.findByRole('menuitem', { name: /Archiviate/ }));
      const dialog = await screen.findByRole('dialog', { name: 'Schede archiviate' });
      expect(await within(dialog).findByText('Vecchia offerta')).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: /Ripristina/ }));
      expect(await within(dialog).findByText('Nessuna scheda archiviata.')).toBeInTheDocument();
      expect(calls.some((c) => c.path.startsWith('/cards/k9/restore'))).toBe(true);
    });
  });

  describe('colonne', () => {
    it('crea una colonna con nome, colore e fase', async () => {
      const user = userEvent.setup();
      const calls = api({
        'POST /boards/b1/columns': () => ({
          status: 201,
          body: { column: column('c9', 'Offerta', 4096) },
        }),
      });
      renderApp('/boards/b1');

      await user.click(await screen.findByRole('button', { name: 'Azioni della vista' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Aggiungi colonna' }));
      const dialog = await screen.findByRole('dialog', { name: 'Nuova colonna' });
      await user.type(within(dialog).getByLabelText('Nome'), 'Offerta');
      await user.click(within(dialog).getByRole('radio', { name: 'Verde' }));
      await user.selectOptions(within(dialog).getByLabelText(/Fase del percorso/), 'offer');
      await user.click(within(dialog).getByRole('button', { name: 'Aggiungi colonna' }));

      await waitFor(() =>
        expect(calls.some((c) => c.method === 'POST' && c.path.includes('/columns'))).toBe(true),
      );
      expect(calls.find((c) => c.path.includes('/columns'))?.body).toEqual({
        name: 'Offerta',
        color: 'green',
        category: 'offer',
      });
    });

    it('rinomina e cambia colore', async () => {
      const user = userEvent.setup();
      const calls = api({
        'PATCH /columns/c2': () => ({
          body: { column: column('c2', 'Candidature', 2048, { color: 'rose' }) },
        }),
      });
      renderApp('/boards/b1');

      await user.click(
        await screen.findByRole('button', { name: 'Azioni per la colonna “Inviate”' }),
      );
      await user.click(await screen.findByRole('menuitem', { name: 'Modifica…' }));
      const dialog = await screen.findByRole('dialog', { name: 'Modifica colonna' });
      const name = within(dialog).getByLabelText('Nome');
      await user.clear(name);
      await user.type(name, 'Candidature');
      await user.click(within(dialog).getByRole('radio', { name: 'Rosa' }));
      await user.click(within(dialog).getByRole('button', { name: 'Salva' }));

      await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({
        name: 'Candidature',
        color: 'rose',
        category: null,
      });
    });

    it('sposta a destra da menu con l’ancora corretta; il primo non può andare a sinistra', async () => {
      const user = userEvent.setup();
      const calls = api(statefulBoard().handlers);
      renderApp('/boards/b1');
      await user.click(
        await screen.findByRole('button', { name: 'Azioni per la colonna “Salvate”' }),
      );
      expect(await screen.findByRole('menuitem', { name: 'Sposta a sinistra' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      await user.click(screen.getByRole('menuitem', { name: 'Sposta a destra' }));

      await waitFor(() =>
        expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
          'Inviate',
          'Salvate',
          'Colloquio',
        ]),
      );
      expect(calls.find((c) => c.path.startsWith('/columns/c1/move'))?.body).toEqual({
        afterId: 'c2',
      });
    });

    it('elimina una colonna vuota dopo conferma', async () => {
      const user = userEvent.setup();
      const calls = api({ 'DELETE /columns/c3': () => ({ body: { id: 'c3' } }) });
      renderApp('/boards/b1');
      await user.click(
        await screen.findByRole('button', { name: 'Azioni per la colonna “Colloquio”' }),
      );
      await user.click(await screen.findByRole('menuitem', { name: 'Elimina…' }));
      const confirm = await screen.findByRole('alertdialog');
      expect(confirm).toHaveTextContent('La colonna è vuota');
      await user.click(within(confirm).getByRole('button', { name: 'Elimina colonna' }));
      await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
      expect(calls.find((c) => c.method === 'DELETE')?.body).toEqual({ moveCardsToColumnId: null });
    });

    it('con schede: non le elimina, chiede dove spostarle e le sposta nella colonna scelta', async () => {
      const user = userEvent.setup();
      const calls = api({ 'DELETE /columns/c1': () => ({ body: { id: 'c1' } }) });
      renderApp('/boards/b1');
      await user.click(
        await screen.findByRole('button', { name: 'Azioni per la colonna “Salvate”' }),
      );
      await user.click(await screen.findByRole('menuitem', { name: 'Elimina…' }));

      const confirm = await screen.findByRole('alertdialog');
      expect(confirm).toHaveTextContent('Contiene 2 schede');
      expect(confirm).toHaveTextContent('Non verrà eliminata nessuna scheda');
      await user.selectOptions(within(confirm).getByLabelText('Sposta le schede in'), 'c3');
      await user.click(within(confirm).getByRole('button', { name: 'Sposta ed elimina' }));

      await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
      expect(calls.find((c) => c.method === 'DELETE')?.body).toEqual({ moveCardsToColumnId: 'c3' });
    });

    it('con schede e nessun’altra colonna l’eliminazione è impedita con un messaggio chiaro', async () => {
      const user = userEvent.setup();
      const only = detail();
      only.columns = [only.columns[0]!];
      const calls = api({ 'GET /boards/b1': () => ({ body: only }) });
      renderApp('/boards/b1');
      await user.click(
        await screen.findByRole('button', { name: 'Azioni per la colonna “Salvate”' }),
      );
      await user.click(await screen.findByRole('menuitem', { name: 'Elimina…' }));
      const dialog = await screen.findByRole('alertdialog');
      expect(dialog).toHaveTextContent('Non puoi eliminare “Salvate”');
      expect(dialog).toHaveTextContent('Crea prima un’altra colonna');
      await user.click(within(dialog).getByRole('button', { name: 'Ho capito' }));
      expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    });
  });

  describe('intestazione', () => {
    it('modifica nome e descrizione; la preferita si attiva con un clic', async () => {
      const user = userEvent.setup();
      const calls = api({
        'PATCH /boards/b1': ({ body }) => ({
          body: { board: { ...detail().board, ...(body as object) } },
        }),
      });
      renderApp('/boards/b1');

      await user.click(await screen.findByRole('button', { name: 'Azioni della vista' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Aggiungi ai preferiti' }));
      await user.click(screen.getByRole('button', { name: 'Azioni della vista' }));
      expect(
        await screen.findByRole('menuitem', { name: 'Rimuovi dai preferiti' }),
      ).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ isFavorite: true });

      await user.click(screen.getByRole('button', { name: 'Azioni della vista' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Modifica bacheca…' }));
      const dialog = await screen.findByRole('dialog', { name: 'Modifica bacheca' });
      const name = within(dialog).getByLabelText('Nome');
      await user.clear(name);
      await user.type(name, 'Nuovo nome');
      await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Nuovo nome' }),
      ).toBeInTheDocument();
    });
  });
});
