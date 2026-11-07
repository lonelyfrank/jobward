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
  it('mostra le cinque voci del workspace e segna quella attiva con aria-current', async () => {
    mockApi(withWorkspace());
    renderApp();
    const nav = await screen.findByRole('navigation', { name: 'Navigazione principale' });
    const links = within(nav)
      .getAllByRole('link')
      .map((l) => l.textContent);
    expect(links).toEqual(['Overview', 'Bacheche', 'Opportunità', 'Attività', 'Insights']);
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('naviga tra le schermate, aggiorna titolo e header e sposta il focus sul contenuto', async () => {
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
      ['Profilo', 'Profilo'],
      ['Aiuto', 'Aiuto'],
    ] as const) {
      if (['Impostazioni', 'Profilo', 'Aiuto'].includes(link)) {
        await user.click(within(nav).getByRole('button', { name: /^Menu account/ }));
        await user.click(await screen.findByRole('menuitem', { name: link }));
      } else {
        await user.click(within(nav).getByRole('link', { name: link }));
      }
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      expect(screen.getByTestId('workspace-page-header')).toHaveTextContent(heading);
      expect(screen.queryByTestId('topbar-title')).not.toBeInTheDocument();
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
    expect(screen.getByTestId('workspace-page-header').closest('main')).toBe(
      screen.getByRole('main'),
    );
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

  it('ricerca globale e creazione sono accessibili dall’header', async () => {
    const user = userEvent.setup();
    mockApi({
      ...withWorkspace(),
      'GET /search': () => ({ body: { opportunities: [], boards: [], interviews: [] } }),
    });
    renderApp();
    await user.click(await screen.findByRole('button', { name: 'Azioni della vista' }));
    expect(await screen.findByRole('menuitem', { name: 'Nuova scheda' })).toBeEnabled();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Cerca in Jobward' }));
    const input = await screen.findByRole('combobox', { name: 'Cerca in Jobward' });
    await user.type(input, 'infermiere');
    expect(await screen.findByText('Nessun risultato per “infermiere”.')).toBeInTheDocument();
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
    // Bacheche, schede e attività sono operative: nessun passo dichiarato «in arrivo».
    expect(screen.queryByText(/In arrivo · M[13]/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aggiungi la tua prima attività' })).toHaveAttribute(
      'href',
      '/tasks',
    );
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
          dueTodayTasks: 1,
          noDueTasks: 0,
        },
        // Scadenza = data di calendario; `dueAt` (primo istante del giorno) resta per retrocompatibilità.
        upcomingTasks: [
          {
            id: 't1',
            title: 'Richiama HR',
            dueAt: Date.UTC(2026, 10, 9, 23, 0),
            dueOn: '2026-11-10',
            cardId: null,
          },
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

    expect(screen.getByRole('link', { name: 'Richiama HR' })).toHaveAttribute('href', '/tasks');
    // Un giorno, non un istante: nessun orario a vista.
    expect(screen.getByText('10 nov 2026')).toBeInTheDocument();
    expect(screen.queryByText(/\d{2}:\d{2}/)).not.toBeInTheDocument();
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
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Azioni della vista' }));
    expect(await screen.findByRole('menuitem', { name: 'Nuova bacheca' })).toBeEnabled();
  });

  it('le schermate future dichiarano la milestone e non offrono azioni attive', async () => {
    mockApi(withWorkspace());
    renderApp('/insights');
    expect(await screen.findByText(/In arrivo · M4/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Azioni della vista' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerca in Jobward' })).toBeEnabled();
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

describe('menu account', () => {
  it('lascia il tema nelle Impostazioni e conserva la scelta quando si usa il menu', async () => {
    const user = userEvent.setup();
    mockApi(withWorkspace());
    renderApp('/settings');

    await user.click(await screen.findByRole('radio', { name: /Scuro/ }));
    await user.click(screen.getByRole('button', { name: /^Menu account/ }));

    const menu = await screen.findByRole('menu', { name: 'Menu account' });
    expect(within(menu).queryByRole('menuitemradio')).not.toBeInTheDocument();
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Profilo', 'Impostazioni', 'Aiuto']);
    await user.click(within(menu).getByRole('menuitem', { name: 'Impostazioni' }));
    expect(screen.getByRole('radio', { name: /Scuro/ })).toBeChecked();
    expect(document.documentElement).toHaveClass('dark');
  });

  it('apre un profilo con i dati reali e una guida con collegamenti alle funzioni disponibili', async () => {
    const user = userEvent.setup();
    mockApi(withWorkspace());
    renderApp();

    await user.click(await screen.findByRole('button', { name: /^Menu account/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Profilo' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Profilo' })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByText(USER.email)).toBeInTheDocument();
    expect(screen.getByText(WORKSPACE.name, { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText(WORKSPACE.timezone, { selector: 'dd' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Menu account/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Aiuto' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Aiuto' })).toBeInTheDocument();
    const main = within(screen.getByRole('main'));
    expect(main.getByRole('link', { name: /Organizza le opportunità/ })).toHaveAttribute(
      'href',
      '/boards',
    );
    expect(main.getByRole('link', { name: 'Segnala un problema' })).toHaveAttribute(
      'href',
      'https://github.com/lonelyfrank/jobward/issues',
    );
  });
});
