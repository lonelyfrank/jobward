import { expect, test, type Page } from '@playwright/test';
import {
  cardLink,
  column,
  createBoard,
  ensureWorkspace,
  expectNoA11yViolations,
  openSection,
  openTab,
  transitionPipeline,
  quickAdd,
  smallTouchTargets,
} from './helpers';

/**
 * M2.1 — informazioni professionali, fase ed esito, statistiche. Stack reale (D1 locale).
 * I test sono seriali: ognuno prosegue dallo stato del precedente.
 */
test.describe.configure({ mode: 'serial' });

const BOARD = 'Dettagli M2';
const main = (page: Page) => page.getByRole('main');
const panelOf = (page: Page, title: string) => page.getByRole('dialog', { name: title });

async function openBoard(page: Page) {
  await page.goto('/boards');
  await main(page).getByRole('link', { name: BOARD }).click();
  await expect(page.getByRole('heading', { level: 1, name: BOARD })).toBeVisible();
}

async function overviewCounts(page: Page) {
  await page.goto('/');
  const grid = page.getByTestId('stat-grid');
  const read = async (label: string) =>
    Number(
      await grid
        .locator('li, div')
        .filter({ hasText: label })
        .locator('p, dd, span')
        .filter({ hasText: /^\d+$/ })
        .first()
        .textContent(),
    );
  return { submitted: await read('Candidature inviate'), interviews: await read('Colloqui') };
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await ensureWorkspace(page);
  await page.close();
});

test('1. una scheda si crea con il solo titolo; i dettagli sono opzionali e le sezioni vuote restano chiuse', async ({
  page,
}) => {
  await createBoard(page, BOARD, 'Minimal');
  await quickAdd(page, 'Da fare', 'Infermiere di reparto');
  await cardLink(page, 'Infermiere di reparto').click();

  const panel = panelOf(page, 'Infermiere di reparto');
  await expect(panel.getByLabel('Titolo')).toHaveValue('Infermiere di reparto');
  // Panoramica (con il riepilogo) subito visibile; in «Dettagli» Opportunità e Candidatura sono chiuse perché vuote.
  await expect(panel.getByRole('region', { name: 'Riepilogo' })).toBeVisible();
  await openTab(panel, 'Dettagli');
  await expect(panel.getByRole('button', { name: /Opportunità/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(panel.getByRole('button', { name: /Candidatura/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(panel.getByLabel('Sede')).toBeHidden();
  await openTab(panel, 'Panoramica');
  await expect(panel.getByLabel('Fase')).toHaveValue('Non indicata');
  await expect(panel.getByLabel('Esito')).toHaveValue('Non indicato');
  await expectNoA11yViolations(page, 'pannello 2.0 (sezioni chiuse)');
});

test('2. azienda, sede, modalità, contratto, retribuzione, date, fase ed esito: si salvano e persistono dopo il refresh', async ({
  page,
}) => {
  await openBoard(page);
  await cardLink(page, 'Infermiere di reparto').click();
  const panel = panelOf(page, 'Infermiere di reparto');

  await panel.getByLabel('Azienda o ente').fill('Ospedale Civile');
  await openSection(panel, 'Opportunità');
  await panel.getByLabel('Posizione lavorativa').fill('Infermiere di reparto');
  await panel.getByLabel('Sede').fill('Brescia');
  await panel.getByLabel('Modalità di lavoro').selectOption('onsite');
  await panel.getByLabel('Tipo di contratto').selectOption('fixed_term');
  await panel.getByLabel('Minima').fill('1.800');
  await panel.getByLabel('Massima').fill('2200');
  await panel.getByLabel('Valuta').fill('eur');
  await panel.getByLabel('Periodicità').selectOption('month');
  await panel.getByLabel('Lordo o netto').selectOption('net');
  await panel.getByLabel('Fonte', { exact: true }).fill('Portale regionale');
  await openSection(panel, 'Candidatura');
  await panel.getByLabel('Data di pubblicazione').fill('2026-10-20');
  await panel.getByLabel('Data di candidatura').fill('2026-10-25');
  await expectNoA11yViolations(page, 'modale — Dettagli con tutte le sezioni aperte');
  await openTab(panel, 'Panoramica');

  await panel.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Modifiche salvate.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Salva' })).toBeDisabled();
  await transitionPipeline(panel, 'advance', 'applied');
  await openTab(panel, 'Timeline');
  await expect(panel.getByText('Candidatura registrata (25 ott 2026)')).toBeVisible();
  await expect(panel.getByText('Fase impostata su “Inviata”')).toBeVisible();

  await page.reload();
  const again = panelOf(page, 'Infermiere di reparto');
  await expect(again.getByLabel('Azienda o ente')).toHaveValue('Ospedale Civile');
  await openTab(again, 'Dettagli');
  await expect(again.getByLabel('Sede')).toHaveValue('Brescia');
  await expect(again.getByLabel('Modalità di lavoro')).toHaveValue('onsite');
  await expect(again.getByLabel('Tipo di contratto')).toHaveValue('fixed_term');
  await expect(again.getByLabel('Minima')).toHaveValue('1800');
  await expect(again.getByLabel('Valuta')).toHaveValue('EUR'); // normalizzata in maiuscolo
  await expect(again.getByLabel('Lordo o netto')).toHaveValue('net');
  await expect(again.getByLabel('Data di candidatura')).toHaveValue('2026-10-25');
  await openTab(again, 'Panoramica');
  await expect(again.getByLabel('Fase')).toHaveValue('Inviata');
  await expect(again.getByLabel('Esito')).toHaveValue('In attesa');
});

test('3. la scheda del Kanban mostra azienda, sede, modalità e fase', async ({ page }) => {
  await openBoard(page);
  const col = column(page, 'Da fare');
  await expect(col.getByText('Ospedale Civile · Brescia · In presenza')).toBeVisible();
  await expect(col.getByText('Inviata', { exact: true })).toBeVisible();
});

test('4. validazione inline: intervallo incoerente e importo senza valuta; la bozza non va persa', async ({
  page,
}) => {
  await openBoard(page);
  await cardLink(page, 'Infermiere di reparto').click();
  const panel = panelOf(page, 'Infermiere di reparto');

  await openTab(panel, 'Dettagli');
  await panel.getByLabel('Minima').fill('3000');
  await panel.getByRole('button', { name: 'Salva' }).click();
  await expect(panel.getByText('La retribuzione minima non può superare la massima')).toBeVisible();
  await expect(panel.getByLabel('Minima')).toHaveValue('3000'); // il valore digitato resta
  await expect(panel.getByLabel('Massima')).toHaveAttribute('aria-invalid', 'true');

  await panel.getByLabel('Minima').fill('1800,5');
  await panel.getByRole('button', { name: 'Salva' }).click();
  await expect(panel.getByText('Inserisci un importo intero')).toBeVisible();

  await panel.getByLabel('Minima').fill('1800');
  await panel.getByLabel('Valuta').fill('');
  await panel.getByRole('button', { name: 'Salva' }).click();
  await expect(panel.getByText('Indica la valuta dell’importo')).toBeVisible();
  await expectNoA11yViolations(page, 'pannello 2.0 con errori');

  await panel.getByRole('button', { name: 'Annulla modifiche' }).click();
  await expect(panel.getByLabel('Valuta')).toHaveValue('EUR');
  await expect(panel.getByRole('button', { name: 'Salva' })).toBeDisabled();
});

test('5. un errore del server non cancella ciò che hai scritto e lo spiega', async ({ page }) => {
  await openBoard(page);
  await cardLink(page, 'Infermiere di reparto').click();
  const panel = panelOf(page, 'Infermiere di reparto');
  await page.route('**/api/v1/cards/*?*', (route) =>
    route.request().method() === 'PATCH'
      ? route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'conflict',
              message: 'La scheda è stata modificata nel frattempo.',
              requestId: 'x',
            },
          }),
        })
      : route.continue(),
  );
  await openTab(panel, 'Dettagli');
  await panel.getByLabel('Sede').fill('Milano');
  await panel.getByRole('button', { name: 'Salva' }).click();
  await expect(panel.getByRole('alert')).toContainText('modificata nel frattempo');
  await expect(panel.getByLabel('Sede')).toHaveValue('Milano');
  await expect(panel.getByRole('button', { name: 'Salva' })).toBeEnabled();
  await page.unroute('**/api/v1/cards/*?*');
  await panel.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Modifiche salvate.')).toBeVisible();
});

test('6. spostare la scheda NON cambia fase né esito; con una colonna che ha una fase compare un suggerimento esplicito', async ({
  page,
}) => {
  await openBoard(page);
  // La colonna "Completate" dichiara la fase "Colloquio".
  await page.getByRole('button', { name: 'Azioni per la colonna “Completate”' }).click();
  await page.getByRole('menuitem', { name: 'Modifica…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifica colonna' });
  await dialog.getByLabel(/Fase del percorso/).selectOption('interviewing');
  await dialog.getByRole('button', { name: 'Salva' }).click();
  await expect(column(page, 'Completate').getByText('Colloquio', { exact: true })).toBeVisible();

  // Sposta dal menu della scheda ("Sposta in …").
  await page.getByRole('button', { name: 'Azioni per la scheda “Infermiere di reparto”' }).click();
  await page.getByRole('menuitem', { name: /Completate/ }).click();
  await expect(
    column(page, 'Completate').getByRole('link', { name: 'Infermiere di reparto' }),
  ).toBeVisible();

  // Il suggerimento c'è, ma fase ed esito sono ancora quelli di prima.
  await expect(
    page.getByText('La colonna “Completate” corrisponde alla fase “Colloquio”.'),
  ).toBeVisible();
  await expect(column(page, 'Completate').getByText('Inviata', { exact: true })).toBeVisible();

  // Si ignora: la fase resta "Inviata" anche dopo il refresh.
  await page.reload();
  await expect(column(page, 'Completate').getByText('Inviata', { exact: true })).toBeVisible();
  await cardLink(page, 'Infermiere di reparto').click();
  const panel = panelOf(page, 'Infermiere di reparto');
  await expect(panel.getByLabel('Fase')).toHaveValue('Inviata');
  await expect(panel.getByLabel('Esito')).toHaveValue('In attesa');
  await expect(panel.getByLabel('Fase')).toHaveAttribute('readonly', '');
});

test('7. il suggerimento si accetta con un clic e non compare quando la fase coincide già', async ({
  page,
}) => {
  await openBoard(page);
  await page.getByRole('button', { name: 'Azioni per la scheda “Infermiere di reparto”' }).click();
  await page.getByRole('menuitem', { name: /Da fare/ }).click();
  await expect(
    column(page, 'Da fare').getByRole('link', { name: 'Infermiere di reparto' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Azioni per la scheda “Infermiere di reparto”' }).click();
  await page.getByRole('menuitem', { name: /Completate/ }).click();
  await page.getByRole('button', { name: 'Gestisci candidatura' }).click();
  await transitionPipeline(panelOf(page, 'Infermiere di reparto'), 'advance', 'interviewing');
  await page.keyboard.press('Escape');
  await expect(column(page, 'Completate').getByText('In colloquio', { exact: true })).toBeVisible();

  // Ora la fase coincide con la colonna: un nuovo spostamento avanti-indietro non propone nulla.
  await page.getByRole('button', { name: 'Azioni per la scheda “Infermiere di reparto”' }).click();
  await page.getByRole('menuitem', { name: /Da fare/ }).click();
  await page.getByRole('button', { name: 'Azioni per la scheda “Infermiere di reparto”' }).click();
  await page.getByRole('menuitem', { name: /Completate/ }).click();
  await expect(page.getByRole('button', { name: 'Gestisci candidatura' })).toHaveCount(0);
});

test('8. Overview: "in colloquio" esclude le candidature concluse; "inviate" usa data o fase', async ({
  page,
}) => {
  const before = await overviewCounts(page);
  await openBoard(page);
  await cardLink(page, 'Infermiere di reparto').click();
  const panel = panelOf(page, 'Infermiere di reparto');
  await expect(panel.getByLabel('Fase')).toHaveValue('Colloquio');
  await transitionPipeline(panel, 'close', 'rejected');
  await openTab(panel, 'Timeline');
  await expect(panel.getByText('Esito registrato: “Rifiutata”')).toBeVisible();
  await page.keyboard.press('Escape');

  const after = await overviewCounts(page);
  expect(after.interviews).toBe(before.interviews - 1); // colloquio concluso: non conta più
  expect(after.submitted).toBe(before.submitted); // ma resta una candidatura inviata
});

test('9. da telefono (390 px) il pannello è a schermo intero e i dettagli si modificano', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openBoard(page);
  await cardLink(page, 'Infermiere di reparto').click();
  const panel = panelOf(page, 'Infermiere di reparto');
  await expect(panel).toBeVisible();
  const box = (await panel.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(388);
  await openTab(panel, 'Dettagli');
  await panel.getByLabel('Sede').fill('Bergamo');
  await panel.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Modifiche salvate.')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  await openSection(panel, 'Opportunità');
  await openSection(panel, 'Candidatura');
  await expectNoA11yViolations(page, 'modale — Dettagli a 390 px');
  expect(await smallTouchTargets(page, '[role=dialog]')).toEqual([]);
  await openTab(panel, 'Panoramica');
  await panel.getByRole('button', { name: 'Aggiungi etichetta' }).click();
  await expectNoA11yViolations(page, 'modale — Panoramica a 390 px');
  expect(await smallTouchTargets(page, '[role=dialog]')).toEqual([]);
});
