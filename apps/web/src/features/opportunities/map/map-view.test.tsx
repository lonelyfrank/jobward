import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mockApi, renderApp, withWorkspace } from '@/test/utils';

const item = (id: string, title: string, latitude: number | null, longitude: number | null) => ({
  id,
  title,
  company: `${title} Srl`,
  jobTitle: null,
  location: latitude === null ? 'Da definire' : `Sede ${title}`,
  city: latitude === null ? null : title,
  latitude,
  longitude,
  boardName: 'Ricerca',
  stage: null,
  outcome: null,
  archivedAt: null,
});

const place = (
  id: string,
  name: string,
  kind: 'home' | 'other',
  latitude: number,
  longitude: number,
) => ({
  id,
  name,
  kind,
  latitude,
  longitude,
  position: 1,
  createdAt: 1,
  updatedAt: 1,
});

function routes(places: unknown[]) {
  return {
    ...withWorkspace(),
    'GET /boards': () => ({ body: { boards: [] } }),
    'GET /labels': () => ({ body: { labels: [] } }),
    'GET /views': () => ({ body: { views: [] } }),
    'GET /me/places': () => ({ body: { places } }),
    'GET /opportunities/cities': () => ({
      body: {
        cities: [
          { city: 'Milano', count: 2 },
          { city: 'Torino', count: 1 },
        ],
        withoutCity: 1,
      },
    }),
    'GET /opportunities/map': () => ({
      body: {
        items: [
          item('k1', 'Torino', 45.0703, 7.6869),
          item('k2', 'Brera', 45.476, 9.1866),
          item('k3', 'Remoto', null, null),
        ],
        total: 3,
        located: 2,
        truncated: false,
      },
    }),
    'GET /opportunities': () => ({
      body: { items: [], total: 0, page: 1, pageSize: 25, pageCount: 0 },
    }),
  };
}

describe('vista Mappa delle opportunità (D-07)', () => {
  it('mostra punti, distanze da casa e dalle altre posizioni, e le opportunità senza coordinate', async () => {
    const calls = mockApi(
      routes([
        place('p1', 'Casa', 'home', 45.486, 9.216),
        place('p2', 'Torino centro', 'other', 45.0703, 7.6869),
      ]),
    );
    renderApp('/opportunities?layout=map&priority=high');

    expect(
      await screen.findByText('2 opportunità sulla mappa, 1 senza coordinate.'),
    ).toBeInTheDocument();
    // Stessi filtri dell'elenco, nessuna richiesta all'elenco paginato.
    const mapCall = calls.find((c) => c.path.startsWith('/opportunities/map'));
    expect(new URL(mapCall!.path, 'http://x').searchParams.get('priority')).toBe('high');
    expect(calls.some((c) => c.path.startsWith('/opportunities?'))).toBe(false);

    // Pannello: la scheda Distanze è quella iniziale quando ci sono posizioni.
    expect(screen.getByRole('tab', { name: 'Distanze' })).toHaveAttribute('aria-selected', 'true');
    const summary = screen.getByRole('list', { name: 'Riepilogo delle distanze per posizione' });
    const home = within(summary).getByRole('listitem', { name: 'Casa' });
    // Verificato a parte con l'emisenoverso: Brera 2,55 km e Torino 128,26 km da casa.
    // Media 65 km, mediana 65 km, più vicina 2,5 km, più lontana 128 km.
    expect(home).toHaveTextContent('CasaMedia65 kmMediana65 kmPiù vicina2,5 kmPiù lontana128 km');
    expect(within(summary).getByRole('listitem', { name: 'Torino centro' })).toHaveTextContent(
      /Più vicina0 m/,
    );

    await userEvent.click(screen.getByRole('tab', { name: 'Elenco (2)' }));
    const list = screen.getByRole('list', { name: /dalla più vicina a Casa/ });
    expect(
      within(list)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Brera', 'Torino']);
    // Distanza dalla posizione scelta in evidenza, le altre sotto.
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent(/Torino centro 1\d\d km/);

    // Ordinare da un'altra posizione cambia l'elenco.
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /Ordina per distanza da/ }),
      'Torino centro',
    );
    const reordered = screen.getByRole('list', { name: /dalla più vicina a Torino centro/ });
    expect(
      within(reordered)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Torino', 'Brera']);

    // Selezionare dall'elenco evidenzia il punto sulla mappa e lo descrive in cima al pannello.
    await userEvent.click(screen.getByRole('button', { name: 'Mostra Brera sulla mappa' }));
    expect(screen.getByRole('region', { name: 'Opportunità selezionata' })).toHaveTextContent(
      'Brera',
    );

    // Le opportunità senza coordinate restano visibili in fondo all'Elenco, con il collegamento ai Dettagli.
    expect(screen.getByRole('tab', { name: 'Elenco (2)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('region', { name: 'Senza coordinate (1)' })).toBeInTheDocument();
    const add = screen.getByRole('link', { name: 'Aggiungi le coordinate di Remoto' });
    expect(add.getAttribute('href')).toMatch(/\/opportunities\/cards\/k3\?.*#dettagli$/);
  });

  it('un segnaposto è un pulsante: selezionarlo mostra le distanze da ogni posizione', async () => {
    mockApi(routes([place('p1', 'Casa', 'home', 45.486, 9.216)]));
    renderApp('/opportunities?layout=map');
    const marker = await screen.findByRole('button', { name: /^Brera, Brera Srl, .* da Casa$/ });
    await userEvent.click(marker);
    expect(marker).toHaveAttribute('aria-pressed', 'true');
    const panel = screen.getByRole('region', { name: 'Opportunità selezionata' });
    expect(within(panel).getByRole('link', { name: 'Brera' })).toBeInTheDocument();
    expect(panel).toHaveTextContent(/Da Casa:\s*2,5 km/);
  });

  it('senza posizioni invita ad aggiungere casa nel Profilo; il selettore torna alla tabella', async () => {
    mockApi(routes([]));
    const { router } = renderApp('/opportunities?layout=map');
    expect(await screen.findByText('Aggiungi casa nel tuo Profilo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Apri il Profilo' })).toHaveAttribute(
      'href',
      '/profile',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Tabella' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await screen.findByText('0 risultati')).toBeInTheDocument();
  });

  it('desktop: ricerca e filtri in un pannello che si richiude, senza i testi che tolgono spazio', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('min-width: 1024px'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    window.localStorage.setItem('jobward.map.filters-open.v1', 'open');
    mockApi(routes([place('p1', 'Casa', 'home', 45.486, 9.216)]));
    renderApp('/opportunities?layout=map&vista=inbox&priority=high');
    expect(
      await screen.findByRole('complementary', { name: 'Personalizza opportunità' }),
    ).not.toHaveAttribute('inert');
    const sidebar = await screen.findByRole('complementary', { name: 'Personalizza opportunità' });
    expect(within(sidebar).getByRole('heading', { name: 'Ricerca e filtri' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('searchbox')).toBeInTheDocument();
    expect(within(sidebar).queryByRole('button', { name: /Colonne/ })).toBeNull();
    // Testi rimossi in vista Mappa (la spiegazione della ricerca resta per i lettori di schermo).
    expect(screen.queryByText(/Inbox: opportunità salvate/)).toBeNull();
    expect(screen.getByText(/Ogni parola deve comparire/)).toHaveClass('sr-only');
    expect(await screen.findByText(/opportunità sulla mappa/)).toHaveClass('sr-only');

    await userEvent.click(within(sidebar).getByRole('button', { name: 'Chiudi ricerca e filtri' }));
    const reopen = await screen.findByRole('button', { name: 'Apri ricerca e filtri (1 attivi)' });
    // Pannello chiuso: resta nel DOM per l'animazione d'uscita ma escluso da tastiera e lettori.
    expect(sidebar).toHaveAttribute('inert');
    expect(window.localStorage.getItem('jobward.map.filters-open.v1')).toBe('closed');
    await userEvent.click(reopen);
    expect(sidebar).not.toHaveAttribute('inert');
    expect(within(sidebar).getByRole('searchbox')).toBeInTheDocument();
    expect(window.localStorage.getItem('jobward.map.filters-open.v1')).toBe('open');
  });

  it('al passaggio del mouse una scheda mostra azienda in testa e offerte sotto, con sede e distanze', async () => {
    const same = (id: string, title: string, company: string) => ({
      ...item(id, title, 45.476, 9.1866),
      company,
      location: 'Via Solferino, Milano',
    });
    mockApi({
      ...routes([place('p1', 'Casa', 'home', 45.486, 9.216)]),
      'GET /opportunities/map': () => ({
        body: {
          items: [
            same('k1', 'Frontend', 'Brera Digital'),
            same('k2', 'Backend', 'Brera Digital'),
            same('k3', 'Analista', 'Alfa'),
            item('k4', 'Torino', 45.0703, 7.6869),
          ],
          total: 4,
          located: 4,
          truncated: false,
        },
      }),
    });
    renderApp('/opportunities?layout=map');
    const group = await screen.findByRole('button', { name: /^3 opportunità: / });
    await userEvent.hover(group);
    const card = await screen.findByTestId('map-card');
    // Aziende in ordine, ciascuna con le sue offerte; sede comune e distanza da casa.
    expect(card).toHaveTextContent(
      /^AlfaAnalistaBrera Digital2BackendFrontendVia Solferino, Milano2,5 km da Casa/,
    );
    await userEvent.unhover(group);
    expect(screen.queryByTestId('map-card')).toBeNull();

    // Una sola offerta: l'azienda in testa, sotto l'offerta.
    await userEvent.hover(screen.getByRole('button', { name: /^Torino, Torino Srl/ }));
    expect(await screen.findByTestId('map-card')).toHaveTextContent(/^Torino SrlTorino/);
  });

  it('desktop stretto (sotto 1280 px) senza preferenza: i filtri partono chiusi per lasciare spazio alla mappa', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('min-width: 1024px'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    expect(window.innerWidth).toBeLessThan(1280);
    mockApi(routes([place('p1', 'Casa', 'home', 45.486, 9.216)]));
    renderApp('/opportunities?layout=map');
    const sidebar = await screen.findByRole('complementary', { name: 'Personalizza opportunità' });
    expect(sidebar).toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: 'Apri ricerca e filtri' })).not.toHaveAttribute(
      'inert',
    );
  });

  it('filtro «Città»: in vista Mappa è il primo gruppo, già aperto, e scrive l’indirizzo', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('min-width: 1024px'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    window.localStorage.setItem('jobward.map.filters-open.v1', 'open');
    const calls = mockApi(routes([place('p1', 'Casa', 'home', 45.486, 9.216)]));
    const { router } = renderApp('/opportunities?layout=map');
    const sidebar = await screen.findByRole('complementary', { name: 'Personalizza opportunità' });
    const group = await within(sidebar).findByRole('group', { name: 'Città' });
    // Prima di «Priorità» (che negli altri casi è il primo gruppo).
    const priority = within(sidebar).getByRole('group', { name: 'Priorità' });
    expect(group.compareDocumentPosition(priority) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(within(group).getByRole('checkbox', { name: /Milano/ }));
    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get('city')).toBe('Milano'),
    );
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.path.startsWith('/opportunities/map') &&
            new URL(c.path, 'http://x').searchParams.get('city') === 'Milano',
        ),
      ).toBe(true),
    );
    expect(within(group).getByRole('checkbox', { name: 'Non indicata' })).not.toBeChecked();
  });
});
