import { expect, test, type Page } from '@playwright/test';
import {
  ensureWorkspace,
  expectNoA11yViolations,
  seedApi,
  smallTouchTargets,
  tableTitles,
} from './helpers';

/** M2.3 — ricerca, filtri, Tabella e Opportunità. Stack reale; i dati si preparano via API. */
test.describe.configure({ mode: 'serial' });

const BOARD = 'Ricerca M2';
const OTHER = 'Seconda M2';
const main = (page: Page) => page.getByRole('main');
const searchBox = (page: Page, name = 'Cerca in questa bacheca') =>
  page.getByRole('searchbox', { name });
const results = (page: Page) =>
  page.getByRole('status').filter({ hasText: /risultat|Ricerca in corso|Aggiornamento/ });

let boardId = '';

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await ensureWorkspace(page);
  const api = await seedApi(page);
  const board = await api.board(BOARD);
  boardId = board.id;
  const other = await api.board(OTHER);
  const [todo, doing] = board.columns;
  const interesting = await api.label('Interessante', 'green');
  const abroad = await api.label('Estero', 'blue');

  const a = await api.card(todo!.id, 'Infermiere di reparto', {
    company: 'Ospedale Civile',
    location: 'Brescia',
    workMode: 'onsite',
    priority: 'high',
    stage: 'applied',
    appliedOn: '2026-10-10',
    salaryMin: 1800,
    salaryMax: 2200,
    currency: 'EUR',
    salaryPeriod: 'month',
    salaryBasis: 'net',
  });
  const b = await api.card(todo!.id, 'Sviluppatore backend', {
    company: 'Acme Srl',
    location: 'Remoto',
    workMode: 'remote',
    priority: 'urgent',
    stage: 'interviewing',
    appliedOn: '2026-10-20',
    description: 'Stack TypeScript',
  });
  await api.card(doing!.id, 'Cuoco di linea', {
    company: 'Trattoria Rossi',
    location: 'Milano',
    workMode: 'onsite',
    priority: 'low',
  });
  await api.card(doing!.id, 'Magazziniere', {
    company: 'Logistica Nord',
    location: 'Torino',
    workMode: 'hybrid',
    stage: 'closed',
    outcome: 'rejected',
  });
  await api.assign(a, interesting);
  await api.assign(b, interesting);
  await api.assign(b, abroad);
  await api.card(other.columns[0]!.id, 'Barista serale', {
    company: 'Caffè Roma',
    location: 'Roma',
    priority: 'medium',
  });
  await page.close();
});

test('1. dal Kanban alla Tabella: stessi dati, stessa bacheca, nessuna perdita', async ({
  page,
}) => {
  await page.goto('/boards');
  await main(page).getByRole('link', { name: BOARD }).click();
  await expect(
    page.getByRole('link', { name: 'Infermiere di reparto', exact: true }),
  ).toBeVisible(); // Kanban
  await page
    .getByRole('navigation', { name: 'Visualizzazione della bacheca' })
    .getByRole('link', { name: 'Tabella' })
    .click();
  await expect(page).toHaveURL(new RegExp(`/boards/${boardId}/table$`));
  await expect(results(page)).toHaveText('4 risultati');
  // Ordine predefinito: ultima modifica, dalla più recente (verificato dal test sugli ordinamenti).
  expect((await tableTitles(page)).sort()).toEqual([
    'Cuoco di linea',
    'Infermiere di reparto',
    'Magazziniere',
    'Sviluppatore backend',
  ]);
  await expect(page.getByText('Barista serale')).toHaveCount(0); // l'altra bacheca non compare
  await expect(page.getByText('Ambito: bacheca “Ricerca M2”')).toBeVisible();
  // Valori assenti: segno e testo per screen reader, mai celle vuote.
  const row = page.locator('tbody tr').filter({ hasText: 'Cuoco di linea' });
  await expect(row.getByText('Non indicato').first()).toBeAttached();
  await expectNoA11yViolations(page, 'tabella bacheca');
  // Torna al Kanban: stessa bacheca.
  await page
    .getByRole('navigation', { name: 'Visualizzazione della bacheca' })
    .getByRole('link', { name: 'Kanban' })
    .click();
  await expect(page.getByRole('link', { name: 'Cuoco di linea', exact: true })).toBeVisible();
});

test('2. la ricerca ha un\'attesa, è nell\'indirizzo e sopravvive al refresh; "nessun risultato" è uno stato chiaro', async ({
  page,
}) => {
  await page.goto(`/boards/${boardId}/table`);
  await expect(results(page)).toHaveText('4 risultati');
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/opportunities')) requests.push(r.url());
  });
  // Digitazione veloce: una sola richiesta dopo la pausa, non una per carattere.
  await searchBox(page).pressSequentially('acme', { delay: 40 });
  await expect(results(page)).toHaveText('1 risultato');
  expect(requests.length).toBeLessThanOrEqual(1);
  await expect(page).toHaveURL(/[?&]q=acme/);
  await expect.poll(() => tableTitles(page)).toEqual(['Sviluppatore backend']);

  await page.reload();
  await expect(searchBox(page)).toHaveValue('acme');
  await expect.poll(() => tableTitles(page)).toEqual(['Sviluppatore backend']);

  // Ogni parola deve comparire, anche in campi diversi (azienda + sede).
  await searchBox(page).fill('ospedale brescia');
  await expect(results(page)).toHaveText('1 risultato');
  await searchBox(page).fill('zzz inesistente');
  await expect(page.getByRole('heading', { name: 'Nessun risultato' })).toBeVisible();
  await expect(results(page)).toHaveText('0 risultati');
  await expectNoA11yViolations(page, 'nessun risultato');
  await page.getByRole('button', { name: 'Cancella filtri' }).first().click();
  await expect(searchBox(page)).toHaveValue('');
  await expect(results(page)).toHaveText('4 risultati');
  await expect(page).not.toHaveURL(/q=/);
});

test('3. caratteri speciali nella ricerca sono letterali e non rompono nulla', async ({ page }) => {
  await page.goto(`/boards/${boardId}/table`);
  for (const q of ["'; DROP TABLE cards; --", '100%', 'a_b', '\\']) {
    await searchBox(page).fill(q);
    await expect(page.getByRole('heading', { name: 'Nessun risultato' })).toBeVisible();
  }
  await searchBox(page).fill('');
  await expect(results(page)).toHaveText('4 risultati');
});

test('4. filtri: OR nello stesso gruppo, AND tra gruppi, contrassegni rimovibili, indirizzo e refresh', async ({
  page,
}) => {
  await page.goto(`/boards/${boardId}/table`);
  await page.getByRole('button', { name: /Filtri/ }).click();
  const panel = page
    .locator('[id]')
    .filter({ has: page.getByRole('group', { name: 'Priorità' }) })
    .last();
  await page.getByRole('group', { name: 'Priorità' }).getByLabel('Alta').check();
  await page.getByRole('group', { name: 'Priorità' }).getByLabel('Urgente').check();
  await expect(results(page)).toHaveText('2 risultati'); // alta OR urgente
  await page.getByRole('group', { name: 'Modalità di lavoro' }).getByLabel('Da remoto').check();
  await expect(results(page)).toHaveText('1 risultato'); // AND con remoto
  await expect(page.getByRole('list', { name: 'Filtri attivi' })).toContainText(
    'Priorità: Alta, Urgente',
  );
  await expect(page.getByRole('list', { name: 'Filtri attivi' })).toContainText(
    'Modalità: Da remoto',
  );
  await page
    .getByRole('group', { name: /Etichette/ })
    .getByLabel('Interessante')
    .check();
  await expect(results(page)).toHaveText('1 risultato');
  await expect.poll(() => tableTitles(page)).toEqual(['Sviluppatore backend']);
  void panel;
  await expectNoA11yViolations(page, 'filtri aperti');

  // Persistenza: refresh e navigazione indietro/avanti.
  await page.reload();
  await expect(results(page)).toHaveText('1 risultato');
  await expect(page.getByRole('button', { name: /Filtri/ })).toContainText('3');
  // Togliere un contrassegno allarga il risultato.
  await page.getByRole('button', { name: 'Rimuovi il filtro: Modalità: Da remoto' }).click();
  await expect(results(page)).toHaveText('2 risultati');
  // Filtri incompatibili → nessun risultato, spiegato.
  await page.getByRole('group', { name: 'Fase' }).getByLabel('Salvata').check();
  await expect(page.getByRole('heading', { name: 'Nessun risultato' })).toBeVisible();
  await page.goBack();
  await expect(results(page)).toHaveText('2 risultati');
  await page.getByRole('button', { name: 'Cancella filtri' }).first().click();
  await expect(results(page)).toHaveText('4 risultati');
});

test('5. filtro per etichetta, per fase "non indicata", per data e per retribuzione', async ({
  page,
}) => {
  await page.goto(`/boards/${boardId}/table?label=`);
  await page.getByRole('button', { name: /Filtri/ }).click();
  await page
    .getByRole('group', { name: /Etichette/ })
    .getByLabel('Estero')
    .check();
  await expect(results(page)).toHaveText('1 risultato');
  await page.getByRole('button', { name: 'Cancella filtri' }).first().click();

  await page.getByRole('group', { name: 'Fase' }).getByLabel('Non indicata').check();
  await expect(results(page)).toHaveText('1 risultato');
  await expect.poll(() => tableTitles(page)).toEqual(['Cuoco di linea']);
  await page.getByRole('button', { name: 'Cancella filtri' }).first().click();

  await page.getByLabel('Dal', { exact: true }).fill('2026-10-15');
  await expect(results(page)).toHaveText('1 risultato');
  await page.getByLabel('Al', { exact: true }).fill('2026-10-01'); // intervallo invertito: avviso, filtro non applicato
  await expect(page.getByText('La data finale precede quella iniziale')).toBeVisible();
  await page.getByRole('button', { name: 'Cancella filtri' }).first().click();

  // Retribuzione: senza valuta e periodicità il filtro non si applica e lo dice.
  await page.getByRole('textbox', { name: 'Da', exact: true }).fill('2000');
  await expect(page.getByText('Indica valuta (3 lettere) e periodicità')).toBeVisible();
  await expect(results(page)).toHaveText('4 risultati');
  await page.getByLabel('Valuta').fill('eur');
  await page.getByLabel('Periodicità').selectOption({ label: 'al mese' });
  await expect(results(page)).toHaveText('1 risultato');
  await expect.poll(() => tableTitles(page)).toEqual(['Infermiere di reparto']);
});

test("6. ordinamento: stato negli header, nell'indirizzo e dopo il refresh; valori mancanti in fondo", async ({
  page,
}) => {
  await page.goto(`/boards/${boardId}/table`);
  const header = page.getByRole('columnheader', { name: /Opportunità/ });
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  await expect
    .poll(() => tableTitles(page))
    .toEqual(['Cuoco di linea', 'Infermiere di reparto', 'Magazziniere', 'Sviluppatore backend']);
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  await expect.poll(async () => (await tableTitles(page))[0]).toBe('Sviluppatore backend');
  await expect(page).toHaveURL(/sort=title/);

  await page.reload();
  await expect(page.getByRole('columnheader', { name: /Opportunità/ })).toHaveAttribute(
    'aria-sort',
    'descending',
  );

  // Priorità per rango (urgente prima), non alfabetico.
  await page
    .getByRole('columnheader', { name: /Priorità/ })
    .getByRole('button')
    .click();
  await expect
    .poll(async () => (await tableTitles(page)).slice(0, 3))
    .toEqual(['Sviluppatore backend', 'Infermiere di reparto', 'Cuoco di linea']);
  // Candidatura: i senza data restano in fondo in entrambi i versi.
  const applied = page.getByRole('columnheader', { name: /Candidatura/ }).getByRole('button');
  await applied.click();
  await expect
    .poll(async () => (await tableTitles(page)).slice(0, 2))
    .toEqual(['Sviluppatore backend', 'Infermiere di reparto']);
  await applied.click();
  await expect
    .poll(async () => (await tableTitles(page)).slice(0, 2))
    .toEqual(['Infermiere di reparto', 'Sviluppatore backend']);
  await expectNoA11yViolations(page, 'tabella ordinata');
});

test('7. dal dettaglio nella tabella: si apre sulla stessa rotta, le modifiche compaiono in tabella e nel Kanban', async ({
  page,
}) => {
  await page.goto(`/boards/${boardId}/table?q=cuoco`);
  const link = page.getByRole('link', { name: 'Cuoco di linea', exact: true });
  await link.click();
  await expect(page).toHaveURL(
    new RegExp(`/boards/${boardId}/table/cards/[0-9a-f-]{36}\\?q=cuoco$`),
  );
  const panel = page.getByRole('dialog', { name: 'Cuoco di linea' });
  await expect(panel).toBeVisible();
  await expect(page.locator('table')).toBeVisible(); // la tabella resta visibile dietro il pannello (modale: nascosta solo alle tecnologie assistive)

  await panel.getByLabel('Fase').selectOption('applied');
  await panel.getByLabel('Priorità').selectOption('urgent');
  await panel.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Modifiche salvate.')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/boards/${boardId}/table\\?q=cuoco$`)); // ricerca conservata
  const row = page.locator('tbody tr').filter({ hasText: 'Cuoco di linea' });
  await expect(row.getByText('Inviata', { exact: true })).toBeVisible(); // la tabella è già aggiornata
  await expect(row.getByText('Urgente')).toBeVisible();
  await expect(link).toBeFocused();

  // Stesso dato nel Kanban.
  await page
    .getByRole('navigation', { name: 'Visualizzazione della bacheca' })
    .getByRole('link', { name: 'Kanban' })
    .click();
  const card = page
    .locator('[data-card-id]')
    .filter({ has: page.getByRole('link', { name: 'Cuoco di linea', exact: true }) });
  await expect(card.getByText('Inviata', { exact: true })).toBeVisible();
  await expect(card.getByText('Priorità urgente')).toBeVisible();
});

test('8. spostare nel Kanban si riflette nella colonna mostrata in tabella', async ({ page }) => {
  await page.goto(`/boards/${boardId}`);
  await page.getByRole('button', { name: 'Azioni per la scheda “Magazziniere”' }).click();
  await page.getByRole('menuitem', { name: 'Completate' }).click();
  await expect(
    page
      .locator('[data-column-id]')
      .filter({ hasText: 'Completate' })
      .getByRole('link', { name: 'Magazziniere' }),
  ).toBeVisible();
  await page.goto(`/boards/${boardId}/table?q=magazziniere`);
  await expect(
    page.locator('tbody tr').filter({ hasText: 'Magazziniere' }).getByText('Completate'),
  ).toBeVisible();
});

test('9. Opportunità: tutte le bacheche, filtro per bacheca, ricerca globale dalla barra superiore', async ({
  page,
}) => {
  await page.goto('/opportunities');
  await expect(page.getByRole('heading', { level: 1, name: 'Opportunità' })).toBeVisible();
  await expect(page.getByText('Ambito: tutte le bacheche')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Bacheca/ })).toBeVisible();
  await expect(results(page)).toContainText('risultati');
  expect(await tableTitles(page)).toContain('Barista serale'); // dell'altra bacheca
  expect(await tableTitles(page)).toContain('Infermiere di reparto');

  await page.getByRole('button', { name: /Filtri/ }).click();
  // Ricerca globale dalla barra superiore (Invio): porta qui con il testo e l'ambito esteso.
  await page.getByRole('searchbox', { name: 'Cerca in tutte le bacheche' }).fill('roma');
  await page.getByRole('searchbox', { name: 'Cerca in tutte le bacheche' }).press('Enter');
  await expect(page).toHaveURL(/\/opportunities\?q=roma$/);
  await expect(searchBox(page, 'Cerca nelle opportunità')).toHaveValue('roma');
  await expect.poll(() => tableTitles(page)).toEqual(['Barista serale']); // "Roma" compare nell'azienda e nella sede
  await expectNoA11yViolations(page, 'opportunità');

  // Dettaglio da qui: pannello sotto /opportunities, chiusura sulla stessa ricerca.
  await page.getByRole('link', { name: 'Barista serale', exact: true }).click();
  await expect(page).toHaveURL(/\/opportunities\/cards\/[0-9a-f-]{36}\?q=roma$/);
  const panel = page.getByRole('dialog', { name: 'Barista serale' });
  await expect(panel.getByLabel('Colonna')).toHaveValue(/.+/);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/opportunities\?q=roma$/);
});

test('10. colonne: mostra/nascondi, ripristino e preferenza locale dopo il refresh', async ({
  page,
}) => {
  await page.goto(`/boards/${boardId}/table`);
  await expect(page.getByRole('columnheader', { name: /Azienda/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Località/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Colonne', exact: true }).click();
  await page.getByRole('group', { name: 'Colonne visibili' }).getByLabel('Azienda').uncheck();
  await page.getByRole('group', { name: 'Colonne visibili' }).getByLabel('Località').check();
  await page.getByRole('group', { name: 'Colonne visibili' }).getByLabel('Retribuzione').check();
  await expect(page.getByRole('columnheader', { name: /Azienda/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /Località/ })).toBeVisible();
  await expect(page.getByRole('cell', { name: /1\.?800/ })).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Colonne visibili' }).getByLabel('Opportunità'),
  ).toBeDisabled(); // la principale non si nasconde

  await page.reload();
  await expect(page.getByRole('columnheader', { name: /Azienda/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /Località/ })).toBeVisible();
  await page.getByRole('button', { name: 'Colonne', exact: true }).click();
  await page.getByRole('button', { name: 'Ripristina colonne predefinite' }).click();
  await expect(page.getByRole('columnheader', { name: /Azienda/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Località/ })).toHaveCount(0);
  // Retribuzione: né lorda né netta se non è stato registrato (la prima la dichiara "netto").
  await page.getByRole('group', { name: 'Colonne visibili' }).getByLabel('Retribuzione').check();
  await expect(page.getByRole('cell', { name: /al mese, netto/ })).toBeVisible();
  const noBasis = page.locator('tbody tr').filter({ hasText: 'Cuoco' });
  await expect(noBasis.getByText(/lordo|netto/)).toHaveCount(0);
});

test('11. paginazione: pagine, indirizzo, indietro e stato dopo il refresh', async ({ page }) => {
  await page.goto('/opportunities');
  const api = await seedApi(page);
  const board = await api.board('Paginazione M2');
  for (let i = 1; i <= 28; i++)
    await api.card(board.columns[0]!.id, `Offerta ${String(i).padStart(2, '0')}`, {
      company: 'Pagine Spa',
    });

  await page.goto('/opportunities?q=pagine&sort=title');
  await expect(results(page)).toHaveText('28 risultati');
  await expect(page.getByText('Pagina 1 di 2')).toBeVisible();
  await expect.poll(async () => (await tableTitles(page)).length).toBe(25);
  await page.getByRole('button', { name: 'Successiva' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText('Pagina 2 di 2')).toBeVisible();
  await expect.poll(() => tableTitles(page)).toEqual(['Offerta 26', 'Offerta 27', 'Offerta 28']);
  await expect(page.getByRole('button', { name: 'Successiva' })).toBeDisabled();
  await page.reload();
  await expect(page.getByText('Pagina 2 di 2')).toBeVisible();
  await page.getByRole('button', { name: 'Precedente' }).click();
  await expect(page.getByText('Pagina 1 di 2')).toBeVisible();
  // Cambiare la ricerca riporta alla prima pagina.
  await page.getByRole('button', { name: 'Successiva' }).click();
  await searchBox(page, 'Cerca nelle opportunità').fill('pagine spa');
  await expect(page.getByText('Pagina 1 di 2')).toBeVisible();
  // Pagina inesistente (indirizzo vecchio): stato spiegato, con via d'uscita.
  await page.goto('/opportunities?q=pagine&page=9');
  await expect(page.getByRole('heading', { name: 'Questa pagina non esiste più' })).toBeVisible();
  await page.getByRole('button', { name: 'Vai alla prima pagina' }).click();
  await expect(page.getByText('Pagina 1 di 2')).toBeVisible();
});

test('12. errore del server: messaggio con "Riprova" e nessun dettaglio tecnico', async ({
  page,
}) => {
  await page.route('**/api/v1/opportunities?**', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: '{"error":{"code":"internal_error","message":"x","requestId":"r"}}',
    }),
  );
  await page.goto(`/boards/${boardId}/table?q=errore`);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Non riusciamo a caricare le opportunità' }),
  ).toBeVisible();
  await expectNoA11yViolations(page, 'tabella in errore');
  await page.unroute('**/api/v1/opportunities?**');
  await page.getByRole('button', { name: 'Riprova' }).click();
  await expect(results(page)).toContainText('risultat');
});

test('13. da telefono (390 px): elenco compatto al posto della tabella, senza scroll orizzontale', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/opportunities?q=ospedale');
  await expect(results(page)).toHaveText('1 risultato');
  await expect(page.getByRole('table')).toBeHidden();
  const list = page.getByRole('list', { name: 'Opportunità' });
  await expect(list.getByRole('link', { name: 'Infermiere di reparto' })).toBeVisible();
  await expect(list.getByText('Ospedale Civile · Brescia')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  await page.getByRole('button', { name: /Filtri/ }).click();
  const filterOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(filterOverflow).toBe(0);
  await expectNoA11yViolations(page, 'opportunità a 390 px con filtri');
  await page.getByRole('button', { name: /Filtri/ }).click();
  await list.getByRole('link', { name: 'Infermiere di reparto' }).click();
  await expect(page.getByRole('dialog', { name: 'Infermiere di reparto' })).toBeVisible();
});

test('14. tablet (768 px): lo scorrimento orizzontale è confinato alla tabella', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/opportunities');
  await page.getByRole('button', { name: 'Colonne', exact: true }).click();
  for (const name of ['Località', 'Modalità', 'Contratto', 'Retribuzione', 'Etichette']) {
    await page
      .getByRole('group', { name: 'Colonne visibili' })
      .getByLabel(name, { exact: true })
      .check();
  }
  const region = page.getByRole('region', { name: /Tabella delle opportunità/ });
  const metrics = await region.evaluate((el) => ({
    scroll: el.scrollWidth,
    client: el.clientWidth,
  }));
  expect(metrics.scroll).toBeGreaterThan(metrics.client); // la tabella scorre dentro il suo contenitore…
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0); // …mai la pagina
  await region.focus();
  await expectNoA11yViolations(page, 'tabella a 768 px');
});

test('15. tema scuro: filtri e tabella senza violazioni di accessibilità', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/opportunities?q=a');
  await page.getByRole('button', { name: /Filtri/ }).click();
  await expect(results(page)).toContainText('risultat');
  await expectNoA11yViolations(page, 'opportunità (scuro)');
});

test('16. da telefono: filtri, ricerca e paginazione hanno aree di tocco di almeno 44 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/opportunities?q=pagine');
  await page.getByRole('button', { name: /Filtri/ }).click();
  await expect(results(page)).toContainText('risultat');
  expect(await smallTouchTargets(page, 'main')).toEqual([]);
});
