import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCardMove } from '@/features/kanban/board-state';
import { emitCardCreated } from '@/features/kanban/card-created';
import { board, boardDetail, card, column } from '@/test/fixtures';
import { mockApi, renderApp, withWorkspace } from '@/test/utils';

const NOW = Date.parse('2026-11-09T10:00:00Z'); // lunedì, mezzogiorno a Roma
const day = (iso: string) => Date.parse(`${iso}T10:00:00Z`);

/** Quattro schede: due in Salvate, una in Inviate, una in Colloquio; dati volutamente eterogenei. */
function detail() {
  const base = boardDetail();
  return {
    ...base,
    columns: [
      column('c1', 'Salvate', 1024, { cardCount: 2, category: 'saved' }),
      column('c2', 'Inviate', 2048, { cardCount: 1 }),
      column('c3', 'Colloquio', 3072, { cardCount: 1 }),
    ],
    cards: [
      card('k1', 'Barista part-time', 'c1', 1024, {
        priority: 'high',
        company: 'Caffè Roma',
        stage: 'applied',
        workMode: 'remote',
        location: 'Roma',
        createdAt: day('2026-11-09'),
        updatedAt: day('2026-11-09'),
      }),
      card('k2', 'Magazziniere', 'c1', 2048, {
        createdAt: day('2026-10-01'),
        updatedAt: day('2026-10-01'),
      }),
      card('k3', 'Cuoco', 'c2', 1024, {
        priority: 'high',
        company: 'Osteria Verdi',
        labelIds: ['l1'],
        createdAt: day('2026-11-09'),
        updatedAt: day('2026-11-09'),
      }),
      card('k4', 'Autista', 'c3', 1024, {
        priority: 'low',
        company: 'Trasporti Sud',
        createdAt: day('2026-11-02'),
        updatedAt: day('2026-11-02'),
      }),
    ],
  };
}

const label = { id: 'l1', name: 'Ristorazione', color: 'blue', cardCount: 1, createdAt: 1 };

function server() {
  let state = detail();
  const handlers = {
    ...withWorkspace(),
    'GET /boards/b1': () => ({ body: state }),
    'GET /labels': () => ({ body: { labels: [label] } }),
    'POST /cards/k1/move': ({ body }: { body: unknown }) => {
      const m = body as { columnId: string; afterCardId: string | null };
      state = applyCardMove(state, { cardId: 'k1', ...m }) ?? state;
      return { body: { card: state.cards.find((c) => c.id === 'k1') } };
    },
  };
  return { handlers, state: () => state };
}

// `hidden`: con il pannello aperto (modale) il resto della pagina è nascosto alle tecnologie assistive.
const listOf = (name: string) =>
  screen.getByRole('list', { name: `Schede in ${name}`, hidden: true });
/** Valore di un parametro dell'indirizzo, già decodificato (`%2C` → `,`). */
const param = (router: { state: { location: { search: string } } }, key: string) =>
  new URLSearchParams(router.state.location.search).get(key);
// `li[data-card-id]`: le etichette di una scheda sono a loro volta una lista (elementi annidati).
const titlesIn = (name: string) =>
  [...listOf(name).querySelectorAll<HTMLElement>('li[data-card-id]')].map(
    (li) => within(li).getAllByRole('link', { hidden: true })[0]!.textContent,
  );
const allTitles = () => ['Salvate', 'Inviate', 'Colloquio'].flatMap(titlesIn);
const columnBadge = (name: string) =>
  within(screen.getByRole('region', { name })).getByTestId('column-count');

async function ready() {
  await screen.findByRole('heading', { level: 1, name: 'Ricerca autunno' }, { timeout: 10_000 });
  await screen.findByRole('list', { name: 'Schede in Salvate' });
}

beforeEach(() => {
  // Solo la data: i timer reali servono a React Query, ai debounce e a user-event.
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Smart Kanban: filtri nell’indirizzo', () => {
  it('senza filtri non c’è nessuna barra e i contatori restano semplici', async () => {
    mockApi(server().handlers);
    renderApp('/boards/b1');
    await ready();

    expect(screen.queryByTestId('smart-filter-bar')).toBeNull();
    expect(allTitles()).toEqual(['Barista part-time', 'Magazziniere', 'Cuoco', 'Autista']);
    expect(columnBadge('Salvate')).toHaveTextContent(/^2$/);
    expect(screen.getByRole('button', { name: 'Filtri' })).toBeInTheDocument();
  });

  it('un filtro nell’indirizzo mostra solo le schede corrispondenti, con visibili/totali', async () => {
    mockApi(server().handlers);
    renderApp('/boards/b1?priorita=high');
    await ready();

    await waitFor(() => expect(allTitles()).toEqual(['Barista part-time', 'Cuoco']));
    expect(screen.getByTestId('smart-filter-count')).toHaveTextContent('2 di 4 schede');
    expect(columnBadge('Salvate')).toHaveTextContent('1/2');
    expect(columnBadge('Salvate')).toHaveAccessibleName('1 di 2 schede');
    expect(columnBadge('Colloquio')).toHaveTextContent('0/1');
    expect(screen.getByRole('button', { name: /Filtri/ })).toHaveTextContent('1');
    const chips = within(screen.getByRole('list', { name: 'Filtri applicati' }));
    expect(chips.getByText('Priorità: Alta')).toBeInTheDocument();
    // Colonna con schede ma nessuna corrispondente: messaggio diverso da «colonna vuota».
    expect(
      within(screen.getByRole('region', { name: 'Colloquio' })).getByText(
        'Nessuna scheda corrisponde ai filtri.',
      ),
    ).toBeInTheDocument();
  });

  it('valori dello stesso campo si sommano (OR), campi diversi si intersecano (AND)', async () => {
    mockApi(server().handlers);
    renderApp('/boards/b1?priorita=high,low&azienda=Osteria%20Verdi&azienda=Trasporti%20Sud');
    await ready();
    // priorità alta O bassa, E azienda Osteria Verdi O Trasporti Sud.
    await waitFor(() => expect(allTitles()).toEqual(['Cuoco', 'Autista']));
    expect(screen.getByTestId('smart-filter-count')).toHaveTextContent('2 di 4 schede');
  });

  it('più campi in AND possono non lasciare nessuna scheda', async () => {
    mockApi(server().handlers);
    renderApp('/boards/b1?priorita=high&modalita=onsite');
    await ready();
    await waitFor(() => expect(allTitles()).toEqual([]));
    expect(screen.getByTestId('smart-filter-count')).toHaveTextContent('0 di 4 schede');
  });

  it('filtra per data nel fuso del workspace (questa settimana / mese precedente)', async () => {
    mockApi(server().handlers);
    const { router } = renderApp('/boards/b1?creata=week');
    await ready();
    await waitFor(() => expect(allTitles()).toEqual(['Barista part-time', 'Cuoco']));
    expect(
      within(screen.getByRole('list', { name: 'Filtri applicati' })).getByText(
        'Creata: Questa settimana',
      ),
    ).toBeInTheDocument();

    // Navigazione temporale dal contrassegno: settimana precedente (2–8 nov) → solo Autista.
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Periodo precedente (Data di creazione)' }),
    );
    await waitFor(() => expect(allTitles()).toEqual(['Autista']));
    expect(router.state.location.search).toBe('?creata=week-1');
    // Avanti riporta alla settimana corrente; da lì non si va nel futuro.
    await user.click(
      screen.getByRole('button', { name: 'Periodo successivo (Data di creazione)' }),
    );
    await waitFor(() => expect(allTitles()).toEqual(['Barista part-time', 'Cuoco']));
    expect(
      screen.getByRole('button', { name: 'Periodo successivo (Data di creazione)' }),
    ).toBeDisabled();
  });

  it('i valori mancanti non soddisfano un filtro positivo; «non indicata» sì', async () => {
    mockApi(server().handlers);
    renderApp('/boards/b1?modalita=none');
    await ready();
    await waitFor(() => expect(allTitles()).toEqual(['Magazziniere', 'Cuoco', 'Autista']));
  });

  it('indirizzo non valido: ripristino sicuro, nessun errore, indirizzo ripulito', async () => {
    mockApi(server().handlers);
    const { router } = renderApp('/boards/b1?fase=inventata&creata=ieri&priorita=high,high&x=1');
    await ready();
    // `priorita=high,high` resta valido (duplicato rimosso); il resto viene scartato.
    await waitFor(() => expect(allTitles()).toEqual(['Barista part-time', 'Cuoco']));
    await waitFor(() => expect(router.state.location.search).toBe('?x=1&priorita=high'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('indirizzo con soli valori non validi: nessun filtro e nessuna barra', async () => {
    mockApi(server().handlers);
    const { router } = renderApp('/boards/b1?fase=inventata&creata=ieri&modalita=ufficio');
    await ready();
    expect(allTitles()).toHaveLength(4);
    expect(screen.queryByTestId('smart-filter-bar')).toBeNull();
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });
});

describe('Smart Kanban: pannello, rimozione e ripristino', () => {
  it('apre il pannello, applica un filtro, lo rimuove dal contrassegno e ripristina', async () => {
    const calls = mockApi(server().handlers);
    const user = userEvent.setup();
    const { router } = renderApp('/boards/b1');
    await ready();

    await user.click(screen.getByRole('button', { name: 'Filtri' }));
    const panel = await screen.findByRole('dialog', { name: 'Filtri' });
    const priority = within(panel).getByRole('group', { name: 'Priorità' });
    await user.click(within(priority).getByRole('checkbox', { name: 'Alta' }));

    await waitFor(() => expect(allTitles()).toEqual(['Barista part-time', 'Cuoco']));
    expect(param(router, 'priorita')).toBe('high');
    await user.click(within(priority).getByRole('checkbox', { name: 'Bassa' }));
    await waitFor(() => expect(allTitles()).toEqual(['Barista part-time', 'Cuoco', 'Autista']));
    expect(param(router, 'priorita')).toBe('high,low');

    // Azienda (elenco ricavato dalle schede) e località testuale.
    await user.click(
      within(within(panel).getByRole('group', { name: 'Azienda' })).getByRole('checkbox', {
        name: 'Osteria Verdi',
      }),
    );
    await waitFor(() => expect(allTitles()).toEqual(['Cuoco']));

    await user.click(within(panel).getByRole('button', { name: 'Fatto' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filtri' })).toBeNull());
    expect(screen.getByRole('button', { name: /Filtri/ })).toHaveFocus();

    // Rimozione di un solo contrassegno: l'altro filtro resta.
    await user.click(
      screen.getByRole('button', { name: 'Rimuovi filtro: Azienda: Osteria Verdi' }),
    );
    await waitFor(() => expect(allTitles()).toEqual(['Barista part-time', 'Cuoco', 'Autista']));

    await user.click(screen.getByRole('button', { name: 'Ripristina filtri' }));
    await waitFor(() => expect(allTitles()).toHaveLength(4));
    expect(router.state.location.search).toBe('');
    expect(screen.queryByTestId('smart-filter-bar')).toBeNull();

    // I filtri agiscono solo sulla vista: nessuna richiesta di scrittura.
    expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });

  it('località testuale e intervallo personalizzato con estremi incoerenti', async () => {
    mockApi(server().handlers);
    const user = userEvent.setup();
    const { router } = renderApp('/boards/b1');
    await ready();

    await user.click(screen.getByRole('button', { name: 'Filtri' }));
    const panel = await screen.findByRole('dialog', { name: 'Filtri' });
    await user.type(within(panel).getByLabelText('Località'), 'ROMA');
    await waitFor(() => expect(allTitles()).toEqual(['Barista part-time']), { timeout: 3000 });
    expect(param(router, 'localita')).toBe('ROMA');

    // Intervallo personalizzato su «Data di creazione».
    await user.selectOptions(within(panel).getByLabelText('Periodo: Data di creazione'), 'custom');
    const from = within(panel).getAllByLabelText('Dal')[0]!;
    const to = within(panel).getAllByLabelText('Al')[0]!;
    expect(from).toHaveValue('2026-11-09');
    await user.clear(to);
    await user.type(to, '2026-11-01');
    // Data finale prima dell'iniziale: avviso, filtro non applicato (resta l'ultimo valido).
    expect(await within(panel).findByRole('alert')).toHaveTextContent('La data finale precede');
    expect(router.state.location.search).not.toContain('2026-11-01');
  });
});

describe('Smart Kanban: stati vuoti', () => {
  it('nessun risultato: messaggio dedicato e «Mostra tutte»', async () => {
    mockApi(server().handlers);
    const user = userEvent.setup();
    renderApp('/boards/b1?priorita=urgent');
    await ready();

    await waitFor(() => expect(allTitles()).toEqual([]));
    expect(screen.getByTestId('smart-filter-count')).toHaveTextContent('0 di 4 schede');
    expect(
      screen.getByText(/Nessuna candidatura corrisponde ai filtri attivi/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mostra tutte' }));
    await waitFor(() => expect(allTitles()).toHaveLength(4));
  });

  it('bacheca vuota con un filtro attivo: messaggio diverso da «nessun risultato»', async () => {
    mockApi({
      ...withWorkspace(),
      'GET /boards/b1': () => ({ body: { ...detail(), cards: [] } }),
      'GET /labels': () => ({ body: { labels: [] } }),
    });
    renderApp('/boards/b1?priorita=high');
    await ready();
    expect(await screen.findByText(/La bacheca non contiene ancora schede/)).toBeInTheDocument();
    expect(screen.queryByText(/Nessuna candidatura corrisponde/)).toBeNull();
  });
});

describe('Smart Kanban: spostamenti con filtri attivi', () => {
  const openMenu = async (user: ReturnType<typeof userEvent.setup>, title: string) =>
    user.click(await screen.findByRole('button', { name: `Azioni per la scheda “${title}”` }));

  it('«Sposta su/giù» è disattivato, «Sposta in…» funziona e porta in fondo alla colonna reale', async () => {
    const s = server();
    const calls = mockApi(s.handlers);
    const user = userEvent.setup();
    renderApp('/boards/b1?priorita=high');
    await ready();
    await waitFor(() => expect(allTitles()).toEqual(['Barista part-time', 'Cuoco']));

    await openMenu(user, 'Barista part-time');
    expect(await screen.findByRole('menuitem', { name: 'Sposta su' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('menuitem', { name: 'Sposta giù' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(screen.getByRole('menuitem', { name: 'Inviate' }));

    // Optimistic: la scheda è nella colonna di destinazione, i contatori seguono.
    await waitFor(() => expect(titlesIn('Inviate')).toEqual(['Cuoco', 'Barista part-time']));
    expect(columnBadge('Salvate')).toHaveTextContent('0/1');
    expect(columnBadge('Inviate')).toHaveTextContent('2/2');
    // In fondo alla colonna reale: dopo l'ultima scheda (Cuoco), nascoste incluse.
    const move = calls.find((c) => c.path.startsWith('/cards/k1/move'));
    expect(move?.body).toEqual({ columnId: 'c2', afterCardId: 'k3' });
    // La scheda nascosta dai filtri (Magazziniere) non è stata toccata.
    expect(s.state().cards.find((c) => c.id === 'k2')?.columnId).toBe('c1');
    expect(calls.filter((c) => c.method !== 'GET')).toHaveLength(1);
  });

  it('senza filtri «Sposta su/giù» resta disponibile', async () => {
    mockApi(server().handlers);
    const user = userEvent.setup();
    renderApp('/boards/b1');
    await ready();
    await openMenu(user, 'Magazziniere');
    expect(await screen.findByRole('menuitem', { name: 'Sposta su' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

describe('Smart Kanban: apertura di una scheda conserva i filtri', () => {
  it('il collegamento della scheda mantiene l’indirizzo dei filtri', async () => {
    mockApi({
      ...server().handlers,
      'GET /cards/k1': () => ({
        status: 404,
        body: { error: { code: 'not_found', message: 'x', requestId: 'r' } },
      }),
    });
    renderApp('/boards/b1?priorita=high');
    await ready();
    await waitFor(() => expect(allTitles()).toHaveLength(2));
    expect(screen.getByRole('link', { name: 'Barista part-time' })).toHaveAttribute(
      'href',
      '/boards/b1/cards/k1?priorita=high',
    );
  });
});

describe('Smart Kanban: scheda creata ma nascosta dai filtri (C1)', () => {
  const HIDDEN = 'Scheda “Nuova scheda” creata, ma non è visibile con i filtri attivi.';
  const newCard = () => card('k9', 'Nuova scheda', 'c1', 3072, { createdAt: NOW, updatedAt: NOW });
  function serverWithCreate() {
    const s = server();
    return {
      ...s.handlers,
      'POST /cards': () => ({ status: 201, body: { card: newCard() } }),
      'GET /boards': () => ({ body: { boards: [board()] } }),
    };
  }
  const noticeOf = (message: HTMLElement) => message.closest('[role="status"]') as HTMLElement;

  async function quickCreate(user: ReturnType<typeof userEvent.setup>) {
    const column = screen.getByRole('region', { name: 'Salvate' });
    await user.click(within(column).getByRole('button', { name: /Aggiungi scheda/ }));
    await user.type(
      within(column).getByLabelText('Titolo della nuova scheda in Salvate'),
      'Nuova scheda{Enter}',
    );
  }

  it('creazione rapida con un filtro che la esclude: salvata, avviso e «Ripristina filtri»', async () => {
    const calls = mockApi(serverWithCreate());
    const user = userEvent.setup();
    const { router } = renderApp('/boards/b1?fase=applied');
    await ready();
    await waitFor(() => expect(allTitles()).toEqual(['Barista part-time']));

    await quickCreate(user);
    const notice = noticeOf(await screen.findByText(HIDDEN));

    // Salvata sul server (una sola richiesta) ma non visibile: il contatore la conta nel totale.
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(allTitles()).toEqual(['Barista part-time']);
    expect(screen.getByTestId('smart-filter-count')).toHaveTextContent('1 di 5 schede');
    expect(router.state.location.search).toBe('?fase=applied');

    await user.click(within(notice).getByRole('button', { name: 'Ripristina filtri' }));
    await waitFor(() =>
      expect(titlesIn('Salvate')).toEqual(['Barista part-time', 'Magazziniere', 'Nuova scheda']),
    );
    expect(router.state.location.search).toBe('');
    expect(screen.queryByText(HIDDEN)).toBeNull();
    // Il ripristino non ha duplicato, modificato né cancellato nulla: solo la creazione iniziale.
    expect(calls.filter((c) => c.method !== 'GET')).toHaveLength(1);
    expect(allTitles().filter((t) => t === 'Nuova scheda')).toHaveLength(1);
    expect(allTitles()).toHaveLength(5);
  });

  it('il ripristino conserva i parametri estranei ai filtri', async () => {
    mockApi(serverWithCreate());
    const user = userEvent.setup();
    const { router } = renderApp('/boards/b1?fase=applied&x=1');
    await ready();
    await waitFor(() => expect(allTitles()).toEqual(['Barista part-time']));
    await quickCreate(user);
    const notice = noticeOf(await screen.findByText(HIDDEN));
    await user.click(within(notice).getByRole('button', { name: 'Ripristina filtri' }));
    await waitFor(() => expect(allTitles()).toHaveLength(5));
    expect(router.state.location.search).toBe('?x=1');
  });

  it('scheda che soddisfa i filtri: compare e non c’è nessun avviso', async () => {
    mockApi(serverWithCreate());
    const user = userEvent.setup();
    renderApp('/boards/b1?creata=today'); // la scheda nuova è creata «oggi»
    await ready();
    await waitFor(() => expect(allTitles()).toEqual(['Barista part-time', 'Cuoco']));

    await quickCreate(user);
    await waitFor(() => expect(titlesIn('Salvate')).toContain('Nuova scheda'));
    expect(screen.queryByText(/non è visibile con i filtri/)).toBeNull();
  });

  it('senza filtri attivi non c’è nessun avviso', async () => {
    mockApi(serverWithCreate());
    const user = userEvent.setup();
    renderApp('/boards/b1');
    await ready();
    await quickCreate(user);
    await waitFor(() => expect(titlesIn('Salvate')).toContain('Nuova scheda'));
    expect(screen.queryByText(/non è visibile con i filtri/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ripristina filtri' })).toBeNull();
  });

  it('una scheda di un’altra bacheca non genera l’avviso; una della bacheca aperta sì', async () => {
    mockApi(serverWithCreate());
    renderApp('/boards/b1?priorita=high');
    await ready();
    await waitFor(() => expect(allTitles()).toEqual(['Barista part-time', 'Cuoco']));

    act(() => emitCardCreated(card('z1', 'Altrove', 'cx', 1, { boardId: 'altra' })));
    expect(screen.queryByText(/non è visibile con i filtri/)).toBeNull();

    act(() => emitCardCreated(card('z2', 'Qui', 'c1', 1)));
    expect(
      await screen.findByText('Scheda “Qui” creata, ma non è visibile con i filtri attivi.'),
    ).toBeInTheDocument();
  });

  it('creazione globale («Nuova scheda» dall’intestazione) nella bacheca filtrata', async () => {
    const calls = mockApi(serverWithCreate());
    const user = userEvent.setup();
    const { router } = renderApp('/boards/b1?fase=applied');
    await ready();
    await waitFor(() => expect(allTitles()).toEqual(['Barista part-time']));

    await user.click(screen.getByRole('button', { name: 'Azioni della vista' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Nuova opportunità' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuova opportunità' });
    await user.type(within(dialog).getByLabelText('Titolo'), 'Nuova scheda');
    await user.keyboard('{Enter}');

    const notice = noticeOf(await screen.findByText(HIDDEN));
    // Resta anche l'avviso di successo della creazione globale.
    expect(await screen.findByText('Opportunità “Nuova scheda” creata.')).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);

    await user.click(within(notice).getByRole('button', { name: 'Ripristina filtri' }));
    await waitFor(() => expect(titlesIn('Salvate')).toContain('Nuova scheda'));
    expect(router.state.location.search).toBe('');
    expect(calls.filter((c) => c.method !== 'GET')).toHaveLength(1);
  });
});

describe('Smart Kanban: indirizzo normalizzato e avviso (C2)', () => {
  const INVALID = /Alcuni filtri del link non erano validi/;
  const settle = () => new Promise((resolve) => setTimeout(resolve, 250));

  it('parametro non valido: scartato, valido conservato, un solo avviso, nessuna nuova voce di cronologia', async () => {
    mockApi(server().handlers);
    const { router } = renderApp('/boards/b1?fase=xyz&priorita=high');
    await ready();

    expect(await screen.findByText(INVALID)).toHaveTextContent('Fase: “xyz” non valido');
    await waitFor(() => expect(router.state.location.search).toBe('?priorita=high'));
    expect(router.state.historyAction).toBe('REPLACE');
    await waitFor(() => expect(allTitles()).toEqual(['Barista part-time', 'Cuoco']));
    // Il filtro valido è attivo e visibile come contrassegno.
    expect(
      within(screen.getByRole('list', { name: 'Filtri applicati' })).getByText('Priorità: Alta'),
    ).toBeInTheDocument();

    await settle(); // altri rendering (etichette caricate, orologio) non ripetono l'avviso
    expect(screen.getAllByText(INVALID)).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull(); // informativo, non un errore
  });

  it('dopo la normalizzazione l’avviso non si ripete; un nuovo link non valido avvisa di nuovo', async () => {
    mockApi(server().handlers);
    const { router } = renderApp('/boards/b1?fase=xyz');
    await ready();
    await screen.findByText(INVALID);
    await waitFor(() => expect(router.state.location.search).toBe(''));

    await act(async () => {
      await router.navigate('/boards/b1?priorita=high,low');
    });
    await settle();
    expect(screen.getAllByText(INVALID)).toHaveLength(1);

    await act(async () => {
      await router.navigate('/boards/b1?modalita=ufficio');
    });
    await waitFor(() => expect(screen.getAllByText(INVALID)).toHaveLength(2));
  });

  it('indirizzo canonico: nessun avviso e nessuna riscrittura', async () => {
    mockApi(server().handlers);
    const { router } = renderApp('/boards/b1?fase=applied&priorita=high&x=1');
    await ready();
    await settle();
    expect(screen.queryByText(INVALID)).toBeNull();
    expect(router.state.location.search).toBe('?fase=applied&priorita=high&x=1');
    expect(router.state.historyAction).toBe('POP');
  });

  it('variazioni solo cosmetiche: indirizzo normalizzato senza avviso', async () => {
    mockApi(server().handlers);
    const { router } = renderApp('/boards/b1?priorita=high,high&creata=week-0&fase=');
    await ready();
    await waitFor(() => expect(router.state.location.search).toBe('?creata=week&priorita=high'));
    await settle();
    expect(screen.queryByText(INVALID)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('etichetta inesistente: rimossa, le valide restano, un solo avviso senza identificativi', async () => {
    mockApi(server().handlers);
    const { router } = renderApp('/boards/b1?etichetta=l1,zzz');
    await ready();

    const message = await screen.findByText(INVALID);
    expect(message).toHaveTextContent('Etichetta: non esiste più');
    expect(message).not.toHaveTextContent('zzz');
    await waitFor(() => expect(router.state.location.search).toBe('?etichetta=l1'));
    await waitFor(() => expect(allTitles()).toEqual(['Cuoco']));
    await settle();
    expect(screen.getAllByText(INVALID)).toHaveLength(1);
  });

  it('con l’elenco etichette non disponibile non si scarta nulla', async () => {
    mockApi({
      ...server().handlers,
      'GET /labels': () => ({
        status: 500,
        body: { error: { code: 'internal', message: 'x', requestId: 'r' } },
      }),
    });
    const { router } = renderApp('/boards/b1?etichetta=l1');
    await ready();
    await settle();
    expect(screen.queryByText(INVALID)).toBeNull();
    expect(router.state.location.search).toBe('?etichetta=l1');
  });
});
