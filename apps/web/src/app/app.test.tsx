import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { EMPTY_OVERVIEW, mockApi, renderApp, USER, WORKSPACE, withWorkspace } from '@/test/utils';

describe('accesso e onboarding', () => {
  it('mostra una schermata chiara se l’accesso non è autorizzato (401)', async () => {
    mockApi({
      'GET /me': () => ({
        status: 401,
        body: { error: { code: 'unauthenticated', message: 'x', requestId: 'r' } },
      }),
    });
    renderApp();
    expect(
      await screen.findByRole('heading', { name: 'Accesso non autorizzato' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Navigazione principale' }),
    ).not.toBeInTheDocument();
  });

  it('offre di riprovare se il server non risponde', async () => {
    mockApi({
      'GET /me': () => ({
        status: 500,
        body: { error: { code: 'internal_error', message: 'x', requestId: 'r' } },
      }),
    });
    renderApp();
    expect(await screen.findByRole('button', { name: /Riprova/ })).toBeInTheDocument();
  });

  it('senza workspace propone l’onboarding e valida il nome prima di inviare', async () => {
    const user = userEvent.setup();
    const calls = mockApi({ 'GET /me': () => ({ body: { user: USER, workspaces: [] } }) });
    renderApp();

    const name = await screen.findByLabelText('Nome dello spazio');
    await user.clear(name);
    await user.click(screen.getByRole('button', { name: 'Crea workspace' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Campo obbligatorio');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('crea il workspace e passa all’Overview, mostrando i dati restituiti dal server', async () => {
    const user = userEvent.setup();
    let created = false;
    const calls = mockApi({
      'GET /me': () => ({ body: { user: USER, workspaces: created ? [WORKSPACE] : [] } }),
      'POST /workspaces': () => {
        created = true;
        return { status: 201, body: { workspace: WORKSPACE } };
      },
      'GET /overview': () => ({ body: EMPTY_OVERVIEW }),
    });
    renderApp();

    await user.click(await screen.findByRole('button', { name: 'Crea workspace' }));

    expect(
      await screen.findByRole('navigation', { name: 'Navigazione principale' }),
    ).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.body).toMatchObject({ name: 'La mia ricerca' });
  });

  it('mostra l’errore del server (es. limite di un workspace) in modo annunciato', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /me': () => ({ body: { user: USER, workspaces: [] } }),
      'POST /workspaces': () => ({
        status: 409,
        body: { error: { code: 'conflict', message: 'Hai già un workspace', requestId: 'r' } },
      }),
    });
    renderApp();
    await user.click(await screen.findByRole('button', { name: 'Crea workspace' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Hai già un workspace');
  });
});

describe('shell e navigazione', () => {
  it('mostra le sei voci previste e segna quella attiva con aria-current', async () => {
    mockApi(withWorkspace());
    renderApp();
    const nav = await screen.findByRole('navigation', { name: 'Navigazione principale' });
    const links = within(nav)
      .getAllByRole('link')
      .map((l) => l.textContent);
    expect(links).toEqual([
      'Overview',
      'Bacheche',
      'Opportunità',
      'Attività',
      'Insights',
      'Impostazioni',
    ]);
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('naviga tra le schermate, aggiorna titolo e topbar e sposta il focus sul contenuto', async () => {
    const user = userEvent.setup();
    mockApi(withWorkspace());
    renderApp();
    const nav = await screen.findByRole('navigation', { name: 'Navigazione principale' });

    for (const [link, heading] of [
      ['Bacheche', 'Bacheche'],
      ['Opportunità', 'Opportunità'],
      ['Attività', 'Attività'],
      ['Insights', 'Insights'],
      ['Impostazioni', 'Impostazioni'],
    ] as const) {
      await user.click(within(nav).getByRole('link', { name: link }));
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      expect(screen.getByTestId('topbar-title')).toHaveTextContent(heading);
      expect(document.title).toBe(`${heading} · Jobward`);
      expect(screen.getByRole('main')).toHaveFocus();
    }
  });

  it('mostra una pagina 404 per percorsi inesistenti, dentro la shell', async () => {
    mockApi(withWorkspace());
    renderApp('/non-esiste');
    expect(await screen.findByRole('heading', { name: 'Pagina non trovata' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navigazione principale' })).toBeInTheDocument();
  });

  it('espone un link "Vai al contenuto" e landmark principali', async () => {
    mockApi(withWorkspace());
    renderApp();
    await screen.findByRole('navigation', { name: 'Navigazione principale' });
    expect(screen.getByRole('link', { name: 'Vai al contenuto' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('comprime la sidebar, mantiene i link accessibili e ricorda la scelta', async () => {
    const user = userEvent.setup();
    mockApi(withWorkspace());
    renderApp();
    const toggle = await screen.findByRole('button', { name: 'Comprimi la barra laterale' });
    await user.click(toggle);

    expect(screen.getByRole('button', { name: 'Espandi la barra laterale' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    // Etichette presenti per gli screen reader anche con la sidebar compressa.
    expect(screen.getByRole('link', { name: 'Bacheche' })).toBeInTheDocument();
    expect(window.localStorage.getItem('jobward-sidebar-collapsed')).toBe('1');
  });

  it('creazione rapida e ricerca globale sono operative: la ricerca porta a Opportunità con il testo', async () => {
    const user = userEvent.setup();
    mockApi({
      ...withWorkspace(),
      'GET /opportunities': () => ({
        body: { items: [], total: 0, page: 1, pageSize: 25, pageCount: 0 },
      }),
      'GET /labels': () => ({ body: { labels: [] } }),
    });
    renderApp();
    expect(await screen.findByRole('button', { name: /Nuova scheda/ })).toBeEnabled();
    const search = screen.getByRole('searchbox', { name: 'Cerca in tutte le bacheche' });
    expect(search).toBeEnabled();
    await user.type(search, 'infermiere{Enter}');
    // Ambito dichiarato e testo già applicato nella casella di ricerca della schermata.
    expect(
      await screen.findByRole('heading', { name: 'Opportunità', level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('searchbox', { name: 'Cerca nelle opportunità' })).toHaveValue(
      'infermiere',
    );
    expect(screen.getByText(/Ambito: tutte le bacheche/)).toBeInTheDocument();
  });
});

describe('Overview', () => {
  it('con workspace vuoto mostra zeri reali e i primi passi, senza dati fittizi', async () => {
    mockApi(withWorkspace());
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Inizia da qui' })).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: 'Riepilogo' });
    expect(within(summary).getAllByText('0')).toHaveLength(5);
    expect(screen.getByText(/Nessuna scadenza in arrivo/)).toBeInTheDocument();
    // M1 è operativa: restano segnalati solo i passi che dipendono da milestone future.
    expect(screen.queryByText(/In arrivo · M1/)).not.toBeInTheDocument();
    expect(screen.getByText(/In arrivo · M3/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Crea la prima bacheca da un template' }),
    ).toHaveAttribute('href', '/boards');
  });

  it('mostra i numeri, le scadenze (nel fuso del workspace) e le bacheche recenti dall’API', async () => {
    mockApi(
      withWorkspace({
        workspaceId: 'w1',
        counts: {
          boards: 2,
          opportunities: 12,
          applicationsSubmitted: 7,
          interviews: 2,
          openTasks: 4,
          overdueTasks: 1,
        },
        // 2026-11-10T08:00:00Z = 09:00 a Roma
        upcomingTasks: [
          { id: 't1', title: 'Richiama HR', dueAt: Date.UTC(2026, 10, 10, 8, 0), cardId: null },
        ],
        recentBoards: [
          { id: 'b1', name: 'Ricerca autunno', color: null, icon: null, updatedAt: 1 },
        ],
        recentCards: [
          {
            id: 'k1',
            title: 'Barista part-time',
            boardId: 'b1',
            boardName: 'Ricerca autunno',
            columnName: 'Salvate',
            updatedAt: 1,
          },
        ],
      }),
    );
    renderApp();
    const summary = await screen.findByRole('region', { name: 'Riepilogo' });
    expect(within(summary).getByText('12')).toBeInTheDocument();
    expect(within(summary).getByText('7')).toBeInTheDocument();
    expect(within(summary).getByText('1 scadute')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Inizia da qui' })).not.toBeInTheDocument();

    expect(screen.getByText('Richiama HR')).toBeInTheDocument();
    expect(screen.getByText(/10 nov 2026.*09:00/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Ricerca autunno' }).length).toBeGreaterThan(0);
    // Opportunità recenti: apre il dettaglio della scheda nella sua bacheca.
    expect(screen.getByRole('link', { name: /Barista part-time/ })).toHaveAttribute(
      'href',
      '/boards/b1/cards/k1',
    );
  });

  it('mostra un errore recuperabile se il riepilogo non si carica', async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi({
      ...withWorkspace(),
      'GET /overview': () =>
        fail
          ? {
              status: 500,
              body: { error: { code: 'internal_error', message: 'x', requestId: 'r' } },
            }
          : { body: EMPTY_OVERVIEW },
    });
    renderApp();
    expect(await screen.findByText('Non riusciamo a caricare il riepilogo.')).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Riprova' }));
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Riepilogo' })).toBeInTheDocument(),
    );
  });
});

describe('schermate base', () => {
  it('Bacheche (vuota) mostra i template letti dai dati condivisi, non scritti nel componente', async () => {
    mockApi({ ...withWorkspace(), 'GET /boards': () => ({ body: { boards: [] } }) });
    renderApp('/boards');
    expect(
      await screen.findByRole('heading', { name: 'Non hai ancora bacheche' }),
    ).toBeInTheDocument();
    const standard = await screen.findByRole('heading', { name: 'Job Search Standard' });
    const list = within(standard.closest('li')!).getByRole('list', {
      name: /Colonne di Job Search Standard/,
    });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((i) => i.textContent),
    ).toEqual(['Salvate', 'Da candidarsi', 'Inviate', 'Contattato', 'Colloquio', 'Concluse']);
    expect(screen.getByRole('button', { name: 'Nuova bacheca' })).toBeEnabled();
  });

  it('le schermate future dichiarano la milestone e non offrono azioni attive', async () => {
    mockApi(withWorkspace());
    renderApp('/insights');
    expect(await screen.findByText(/In arrivo · M4/)).toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryAllByRole('button')).toHaveLength(0);
  });

  it('Impostazioni cambia davvero il tema e mostra workspace e account reali', async () => {
    const user = userEvent.setup();
    mockApi(withWorkspace());
    renderApp('/settings');
    await user.click(await screen.findByRole('radio', { name: /Scuro/ }));
    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('jobward-theme')).toBe('dark');
    expect(screen.getByText('La mia ricerca', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('Europe/Rome')).toBeInTheDocument();
    expect(screen.getByText(USER.email, { selector: 'dd' })).toBeInTheDocument();
  });
});

describe('tema condiviso tra componenti', () => {
  it('il menu account riflette il tema scelto in Impostazioni (stato unico)', async () => {
    const user = userEvent.setup();
    mockApi(withWorkspace());
    renderApp('/settings');

    await user.click(await screen.findByRole('radio', { name: /Scuro/ }));
    await user.click(screen.getByRole('button', { name: 'Menu account' }));

    expect(await screen.findByRole('menuitemradio', { name: 'Scuro' })).toBeChecked();
    expect(screen.getByRole('menuitemradio', { name: 'Come il sistema' })).not.toBeChecked();
  });

  it('e viceversa: la scelta dal menu aggiorna le Impostazioni', async () => {
    const user = userEvent.setup();
    mockApi(withWorkspace());
    renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: 'Menu account' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Chiaro' }));

    expect(screen.getByRole('radio', { name: /Chiaro/ })).toBeChecked();
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
