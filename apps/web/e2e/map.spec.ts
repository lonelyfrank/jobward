import { expect, test, type Page } from '@playwright/test';
import { ensureWorkspace, expectNoA11yViolations, openSection, openTab, seedApi } from './helpers';

/**
 * D-07 — vista Mappa delle opportunità. Stack reale (D1 locale di prova): coordinate inserite
 * dall'utente nei Dettagli, casa nel Profilo, stessi filtri dell'elenco, nessuna chiamata esterna.
 */
test.describe.configure({ mode: 'serial' });

const TAG = 'Mappa E2E';
let cards: string[] = [];

/** 1×1 px PNG: sostituisce le tile di OpenStreetMap, così il test non dipende dalla rete. */
const BLANK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Richieste che escono dall'applicazione (solo le tile dello stradario sono ammesse). */
function trackExternalRequests(page: Page) {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname !== 'localhost' && url.protocol.startsWith('http')) external.push(url.href);
  });
  return external;
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await ensureWorkspace(page);
  const api = await seedApi(page);
  const board = await api.board(`Bacheca ${TAG}`);
  const columnId = board.columns[0]!.id;
  cards = [
    await api.card(columnId, `${TAG} Milano`, { company: 'Alfa', location: 'Milano' }),
    await api.card(columnId, `${TAG} Torino`, {
      company: 'Beta',
      location: 'Torino',
      latitude: 45.0703,
      longitude: 7.6869,
    }),
    await api.card(columnId, `${TAG} Remoto`, { company: 'Gamma', location: 'Da remoto' }),
  ];
  await page.close();
});

test.afterAll(async ({ browser }) => {
  // Le schede archiviate non compaiono negli elenchi degli altri spec.
  const page = await browser.newPage();
  const api = await seedApi(page);
  for (const id of cards) await api.archive(id);
  await page.close();
});

test('1. coordinate dai Dettagli e casa dal Profilo, lette senza servizi esterni', async ({
  page,
}) => {
  const external = trackExternalRequests(page);
  await page.goto(`/opportunities/cards/${cards[0]}`);
  const panel = page.getByRole('dialog', { name: `${TAG} Milano` });
  await openTab(panel, 'Dettagli');
  await openSection(panel, 'Opportunità');
  await panel
    .getByLabel('Coordinate', { exact: true })
    .fill('https://www.google.com/maps/place/Duomo/@45.4642,9.19,17z');
  await openTab(panel, 'Panoramica');
  await panel.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Modifiche salvate.')).toBeVisible();
  await page.reload();
  const again = page.getByRole('dialog', { name: `${TAG} Milano` });
  await openTab(again, 'Dettagli');
  await expect(again.getByLabel('Coordinate', { exact: true })).toHaveValue('45.4642, 9.19');

  await page.goto('/profile');
  const places = page.getByRole('region', { name: 'Le tue posizioni' });
  await places.getByRole('button', { name: 'Aggiungi una posizione' }).click();
  await places.getByLabel('Nome').fill('Casa');
  await expect(places.getByLabel('Tipo')).toHaveValue('home');
  await places.getByLabel('Coordinate').fill('45,486; 9,216');
  await places.getByRole('button', { name: 'Salva posizione' }).click();
  await expect(places.getByRole('list', { name: 'Posizioni salvate' })).toContainText('Casa');
  await expectNoA11yViolations(page, 'Profilo — posizioni');
  expect(external).toEqual([]);
});

test('2. la Mappa usa i filtri dell’elenco e riassume le distanze da casa', async ({ page }) => {
  // Schermo da portatile comune: mappa e pannello devono stare nella pagina senza scorrere.
  await page.setViewportSize({ width: 1440, height: 900 });
  const external = trackExternalRequests(page);
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: BLANK_PNG }),
  );
  await page.goto('/opportunities');
  await page.getByRole('button', { name: 'Mappa' }).click();
  await expect(page).toHaveURL(/layout=map/);
  // La ricerca sta nel pannello «Ricerca e filtri», che si richiude per allargare la mappa.
  const filters = page.getByRole('complementary', { name: 'Personalizza opportunità' });
  await expect(filters.getByRole('heading', { name: 'Ricerca e filtri' })).toBeVisible();
  await page.getByRole('searchbox').fill(TAG);
  await expect(page.getByText('2 opportunità sulla mappa, 1 senza coordinate.')).toBeAttached();

  // Milano ≈ 2,7 km e Torino ≈ 128 km da casa (calcolo verificato nei test unitari).
  const summary = page.getByRole('list', { name: 'Riepilogo delle distanze per posizione' });
  await expect(summary.getByRole('listitem', { name: 'Casa' })).toContainText('128 km');
  await page.getByRole('tab', { name: 'Elenco (2)' }).click();
  const list = page.getByRole('list', { name: /dalla più vicina a Casa/ });
  await expect(list.getByRole('link')).toHaveText([`${TAG} Milano`, `${TAG} Torino`]);
  await expect(
    page.getByRole('link', { name: `Aggiungi le coordinate di ${TAG} Remoto` }),
  ).toBeVisible();

  // Mappa e pannello stanno interamente nello schermo, senza scorrere la pagina.
  for (const target of [
    page.getByTestId('opportunity-map'),
    page.getByRole('region', { name: 'Distanze e opportunità' }),
  ]) {
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(900);
    expect(box!.height).toBeGreaterThan(400);
  }

  // Richiudere il pannello dei filtri allarga la mappa; riaprirlo ripresenta ricerca e filtri.
  const mapWidth = async () => (await page.getByTestId('opportunity-map').boundingBox())!.width;
  const before = await mapWidth();
  await page.getByRole('button', { name: 'Chiudi ricerca e filtri' }).click();
  await expect.poll(mapWidth).toBeGreaterThan(before + 150);
  await page.getByRole('button', { name: /^Apri ricerca e filtri/ }).click();
  await expect(page.getByRole('searchbox')).toBeVisible();

  // Un filtro in più restringe anche la mappa.
  await page.getByRole('searchbox').fill(`${TAG} Torino`);
  await expect(page.getByText('1 opportunità sulla mappa.')).toBeAttached();

  // Segnaposto accessibile da tastiera; la selezione mostra la distanza da casa.
  const marker = page.getByRole('button', {
    name: new RegExp(`^${TAG} Torino, Beta, .* da Casa$`),
  });
  await marker.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Opportunità selezionata' })).toContainText(
    'Da Casa:',
  );

  // Al passaggio del mouse: scheda con l'azienda in testa, sotto l'offerta, poi la distanza.
  await marker.hover();
  const card = page.getByTestId('map-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Beta');
  await expect(card).toContainText(`${TAG} Torino`);
  await expect(card).toContainText('da Casa');
  await expectNoA11yViolations(page, 'Opportunità — vista Mappa');

  // Stradario OpenStreetMap: le uniche richieste esterne sono le tile, con l'attribuzione visibile.
  expect(external.length).toBeGreaterThan(0);
  expect(external.every((url) => url.startsWith('https://tile.openstreetmap.org/'))).toBe(true);
  await expect(page.getByRole('link', { name: 'contributori di OpenStreetMap' })).toBeVisible();

  // Spento, nessuna richiesta esterna nemmeno spostando la mappa; la scelta resta dopo il refresh.
  const streets = page.getByRole('button', { name: 'Stradario OpenStreetMap' });
  await streets.click();
  await expect(streets).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('map-tiles')).toHaveCount(0);
  const requestsBefore = external.length;
  await page.getByRole('button', { name: 'Ingrandisci' }).click();
  await page.getByTestId('opportunity-map').focus();
  await page.keyboard.press('ArrowRight');
  await page.reload();
  await expect(page.getByTestId('opportunity-map')).toBeVisible();
  await page.getByRole('button', { name: 'Ingrandisci' }).click();
  expect(external.length).toBe(requestsBefore);
  await expect(page.getByText('Confini: Natural Earth')).toBeVisible();
});

test('3. la vista Mappa sta in una sola schermata, senza scroll, a ogni dimensione', async ({
  page,
}) => {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: BLANK_PNG }),
  );
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1366, 768],
    [1280, 720],
    [1024, 768],
    [768, 1024],
    [390, 844],
    [360, 740],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(`/opportunities?layout=map&q=${encodeURIComponent(TAG)}`);
    await expect(page.getByTestId('opportunity-map')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Distanze e opportunità' })).toBeVisible();
    const size = `${width}×${height}`;
    await expect
      .poll(() => page.getByRole('main').evaluate((el) => el.scrollHeight - el.clientHeight), {
        message: `scroll della pagina a ${size}`,
      })
      .toBeLessThanOrEqual(0);
    for (const target of [
      page.getByTestId('opportunity-map'),
      page.getByRole('region', { name: 'Distanze e opportunità' }),
    ]) {
      const box = (await target.boundingBox())!;
      expect(box.y + box.height, size).toBeLessThanOrEqual(height);
      expect(box.height, size).toBeGreaterThan(150);
    }
  }
  // Sotto i 1024 px ricerca e filtri si aprono in un pannello sovrapposto.
  await page.getByRole('button', { name: /^Apri ricerca e filtri/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Ricerca e filtri' });
  await expect(sheet.getByRole('searchbox')).toHaveValue(TAG);
  await sheet.getByRole('button', { name: 'Chiudi ricerca e filtri' }).click();
  await expect(sheet).toBeHidden();
});
