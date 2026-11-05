import { expect, test, type Page } from '@playwright/test';
import {
  cardLink,
  column,
  createBoard,
  ensureWorkspace,
  expectNoA11yViolations,
  openSection,
  openTab,
  titlesIn,
} from './helpers';

// Flusso completo dell'utente su stack reale (D1 locale): ogni test continua dallo stato del precedente.
test.describe.configure({ mode: 'serial' });

// La barra laterale elenca anche le bacheche recenti: i link della pagina si cercano nel contenuto principale.
const main = (page: Page) => page.getByRole('main');

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await ensureWorkspace(page);
  await page.close();
});

test('galleria vuota: invita a creare la prima bacheca, senza dati fittizi', async ({ page }) => {
  await page.goto('/boards');
  await expect(page.getByRole('heading', { name: 'Non hai ancora bacheche' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Colonne di Job Search Standard' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Ricerca|Estate|Autunno/ })).toHaveCount(0);
  await expectNoA11yViolations(page, 'galleria vuota');
});

test('1-2. crea una bacheca da template: colonne create insieme, persistenti dopo il refresh', async ({
  page,
}) => {
  await page.goto('/boards');
  await page.getByRole('button', { name: 'Crea la tua prima bacheca' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuova bacheca' });
  await expectNoA11yViolations(page, 'dialogo nuova bacheca');

  await dialog.getByRole('button', { name: 'Crea bacheca' }).click(); // nome vuoto
  await expect(dialog.getByRole('alert')).toContainText('Campo obbligatorio');

  await dialog.getByLabel('Nome', { exact: true }).fill('Ricerca autunno');
  await dialog.getByLabel('Descrizione (facoltativa)').fill('Offerte per la stagione autunnale');
  await dialog.getByRole('radio', { name: 'Blu' }).check({ force: true });
  await expect(dialog.getByRole('radio', { name: /Job Search Standard/ })).toBeChecked();
  await dialog.getByRole('button', { name: 'Crea bacheca' }).click();

  await expect(page).toHaveURL(/\/boards\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Ricerca autunno' })).toBeVisible();
  const names = ['Salvate', 'Da candidarsi', 'Inviate', 'Contattato', 'Colloquio', 'Concluse'];
  for (const name of names) await expect(column(page, name)).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Ricerca autunno' })).toBeVisible();
  await expect(page.locator('[data-column-id]')).toHaveCount(6);
  await expectNoA11yViolations(page, 'bacheca appena creata');
});

test('galleria: bacheca con conteggi, preferita in evidenza, secondo template e bacheca personalizzata', async ({
  page,
}) => {
  await createBoard(page, 'Lavoretti estivi', 'Minimal');
  await createBoard(page, 'Bacheca vuota', 'Personalizzata');
  await expect(page.getByText(/non ha ancora colonne/)).toBeVisible();

  await page.goto('/boards');
  const mine = main(page).getByRole('link', { name: 'Lavoretti estivi' });
  await expect(mine).toBeVisible();
  await expect(page.getByText('3 colonne · 0 schede')).toBeVisible();
  await expect(page.getByText('0 colonne · 0 schede')).toBeVisible();

  await page.getByRole('button', { name: 'Aggiungi “Lavoretti estivi” ai preferiti' }).click();
  await expect(
    page.getByRole('region', { name: 'Preferite' }).getByRole('link', { name: 'Lavoretti estivi' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Preferite' }).getByRole('link', { name: 'Lavoretti estivi' }),
  ).toBeVisible();
  await expectNoA11yViolations(page, 'galleria con bacheche');
});

test('3. rinomina la bacheca e modifica la descrizione; persiste', async ({ page }) => {
  await page.goto('/boards');
  await page.getByRole('button', { name: 'Azioni per “Bacheca vuota”' }).click();
  await page.getByRole('menuitem', { name: 'Modifica…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifica bacheca' });
  await dialog.getByLabel('Nome', { exact: true }).fill('Progetti paralleli');
  await dialog.getByLabel('Descrizione (facoltativa)').fill('Ricerca in un altro settore');
  await dialog.getByRole('button', { name: 'Salva' }).click();
  await expect(main(page).getByRole('link', { name: 'Progetti paralleli' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Ricerca in un altro settore')).toBeVisible();
});

test('riordina le bacheche da menu; l’ordine resta dopo il refresh', async ({ page }) => {
  await page.goto('/boards');
  const order = () =>
    page
      .getByRole('region', { name: 'Tutte le bacheche' })
      .getByRole('heading', { level: 3 })
      .allTextContents();
  await expect.poll(order).toEqual(['Ricerca autunno', 'Progetti paralleli']);
  await page.getByRole('button', { name: 'Azioni per “Progetti paralleli”' }).click();
  await page.getByRole('menuitem', { name: 'Sposta su' }).click();
  await expect.poll(order).toEqual(['Progetti paralleli', 'Ricerca autunno']);
  await page.reload();
  await expect.poll(order).toEqual(['Progetti paralleli', 'Ricerca autunno']);
});

test('4-5. colonne: crea, rinomina, cambia colore e fase, sposta', async ({ page }) => {
  await page.goto('/boards');
  await main(page).getByRole('link', { name: 'Progetti paralleli' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Progetti paralleli' })).toBeVisible();

  for (const name of ['Idee', 'Da fare ora', 'Fatto']) {
    await page.getByRole('button', { name: 'Aggiungi colonna' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuova colonna' });
    await dialog.getByLabel('Nome', { exact: true }).fill(name);
    await dialog.getByRole('button', { name: 'Aggiungi colonna' }).click();
    await expect(column(page, name)).toBeVisible();
  }

  await page.getByRole('button', { name: 'Azioni per la colonna “Idee”' }).click();
  await page.getByRole('menuitem', { name: 'Modifica…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifica colonna' });
  await dialog.getByLabel('Nome', { exact: true }).fill('Spunti');
  await dialog.getByRole('radio', { name: 'Viola' }).check({ force: true });
  await dialog.getByLabel(/Fase del percorso/).selectOption('saved');
  await dialog.getByRole('button', { name: 'Salva' }).click();
  await expect(column(page, 'Spunti')).toBeVisible();
  await expect(column(page, 'Spunti').getByText('Salvata', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Azioni per la colonna “Fatto”' }).click();
  await page.getByRole('menuitem', { name: 'Sposta a sinistra' }).click();
  const order = () => page.locator('[data-column-id] h3').allTextContents();
  await expect.poll(order).toEqual(['Spunti', 'Fatto', 'Da fare ora']);
  await page.reload();
  await expect.poll(order).toEqual(['Spunti', 'Fatto', 'Da fare ora']);
});

test('6. creazione rapida: solo il titolo, Invio per aggiungere in serie, persiste', async ({
  page,
}) => {
  await page.goto('/boards');
  await main(page).getByRole('link', { name: 'Ricerca autunno' }).click();
  await expect(column(page, 'Salvate')).toBeVisible();

  const col = column(page, 'Salvate');
  await col.getByRole('button', { name: /Aggiungi scheda/ }).click();
  const input = col.getByLabel('Titolo della nuova scheda in Salvate');
  await expect(input).toBeFocused();
  await input.press('Enter');
  await expect(col.getByRole('alert')).toContainText('Scrivi un titolo');
  for (const title of ['Barista part-time', 'Magazziniere', 'Addetto vendite']) {
    await input.fill(title);
    await input.press('Enter');
    await expect(col.getByRole('link', { name: title })).toBeVisible();
    await expect(input).toBeFocused();
  }
  await input.press('Escape');
  await expect(col.getByRole('button', { name: /Aggiungi scheda/ })).toBeFocused();
  await expect(col.getByLabel('3 schede')).toBeVisible();

  await page.reload();
  await expect
    .poll(() => titlesIn(page, 'Salvate'))
    .toEqual(['Barista part-time', 'Magazziniere', 'Addetto vendite']);
});

test('7. pannello di dettaglio: si apre sulla bacheca, modifica i dati, mostra la cronologia', async ({
  page,
}) => {
  await page.goto('/boards');
  await main(page).getByRole('link', { name: 'Ricerca autunno' }).click();
  await cardLink(page, 'Barista part-time').click();

  const panel = page.getByRole('dialog', { name: 'Barista part-time' });
  await expect(panel).toBeVisible();
  await expect(page).toHaveURL(/\/cards\/[0-9a-f-]{36}$/);
  // La bacheca resta visibile dietro il pannello (per le tecnologie assistive è nascosta: modale).
  await expect(page.locator('[data-column-id]').first()).toBeVisible();
  await expectNoA11yViolations(page, 'modale della candidatura (Panoramica)');
  await openTab(panel, 'Cronologia');
  await expect(panel.getByText('Scheda creata in “Salvate”')).toBeVisible();
  await openTab(panel, 'Panoramica');

  // "Salva" è disattivato finché non c'è una modifica.
  await expect(panel.getByRole('button', { name: 'Salva' })).toBeDisabled();
  await panel.getByLabel('Titolo').fill('Barista part-time serale');
  await panel.getByLabel('Azienda').fill('Caffè Roma');
  await panel.getByLabel('Priorità').selectOption('high');
  await openSection(panel, 'Opportunità');
  await panel.getByLabel('Note').fill('Turni dalle 18 alle 24.');
  await panel.getByLabel('Indirizzo dell’annuncio').fill('non un url');
  await panel.getByRole('button', { name: 'Salva' }).click();
  await expect(panel.getByRole('alert')).toContainText('indirizzo web valido');

  await panel.getByLabel('Indirizzo dell’annuncio').fill('https://example.com/annunci/42');
  await panel.getByRole('button', { name: 'Salva' }).click();
  await openTab(panel, 'Cronologia');
  await expect(panel.getByText('Priorità cambiata da nessuna a alta')).toBeVisible();
  await openTab(panel, 'Dettagli');
  await expect(panel.getByRole('link', { name: /Apri l’annuncio/ })).toHaveAttribute(
    'href',
    'https://example.com/annunci/42',
  );

  // Chiusura con Esc: il focus torna alla scheda nella bacheca.
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page).toHaveURL(/\/boards\/[0-9a-f-]{36}$/);
  await expect(cardLink(page, 'Barista part-time serale')).toBeFocused();
  await expect(column(page, 'Salvate').getByText('Caffè Roma')).toBeVisible();
  await expect(column(page, 'Salvate').getByText('Priorità alta')).toBeVisible();

  // Persistenza.
  await page.reload();
  await expect(column(page, 'Salvate').getByText('Caffè Roma')).toBeVisible();
  await cardLink(page, 'Barista part-time serale').click();
  // Ora la sezione contiene dati: si apre da sola.
  await expect(page.getByRole('dialog').getByLabel('Note')).toHaveValue('Turni dalle 18 alle 24.');
});

test('indirizzo del pannello condivisibile: aprendolo direttamente si vede bacheca e scheda', async ({
  page,
}) => {
  await page.goto('/boards');
  await main(page).getByRole('link', { name: 'Ricerca autunno' }).click();
  await cardLink(page, 'Magazziniere').click();
  const url = page.url();
  await page.goto(url);
  await expect(page.getByRole('dialog', { name: 'Magazziniere' })).toBeVisible();
  await expect(page.locator('[data-column-id]').first()).toBeVisible();
  await page.goBack(); // "indietro" chiude il pannello
  await expect(page.getByRole('dialog', { name: 'Magazziniere' })).toBeHidden();
});

test('sposta dal selettore Colonna del pannello; la cronologia registra lo spostamento', async ({
  page,
}) => {
  await page.goto('/boards');
  await main(page).getByRole('link', { name: 'Ricerca autunno' }).click();
  await cardLink(page, 'Magazziniere').click();
  const panel = page.getByRole('dialog', { name: 'Magazziniere' });
  await panel.getByLabel('Colonna').selectOption({ label: 'Inviate' });
  await openTab(panel, 'Cronologia');
  await expect(panel.getByText('Spostata da “Salvate” a “Inviate”')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(() => titlesIn(page, 'Inviate')).toEqual(['Magazziniere']);
  await expect
    .poll(() => titlesIn(page, 'Salvate'))
    .toEqual(['Barista part-time serale', 'Addetto vendite']);
});

test('12. archivia con "Annulla", poi ripristina dal pannello Archiviate', async ({ page }) => {
  await page.goto('/boards');
  await main(page).getByRole('link', { name: 'Ricerca autunno' }).click();

  await page.getByRole('button', { name: 'Azioni per la scheda “Addetto vendite”' }).click();
  await page.getByRole('menuitem', { name: 'Archivia' }).click();
  await expect(cardLink(page, 'Addetto vendite')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Archiviate/ })).toContainText('1');
  await expect(page.getByText('Scheda “Addetto vendite” archiviata.')).toBeVisible();

  // "Annulla" nell'avviso la ripristina.
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();
  await expect(cardLink(page, 'Addetto vendite')).toBeVisible();

  // Archivia dal pannello e ripristina dall'elenco.
  await cardLink(page, 'Addetto vendite').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archivia' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(cardLink(page, 'Addetto vendite')).toHaveCount(0);

  await page.reload(); // persiste archiviata
  await expect(cardLink(page, 'Addetto vendite')).toHaveCount(0);
  await page.getByRole('button', { name: /Archiviate/ }).click();
  const list = page.getByRole('dialog', { name: 'Schede archiviate' });
  await expect(list.getByText('Addetto vendite', { exact: true })).toBeVisible();
  await expectNoA11yViolations(page, 'schede archiviate');
  await list.getByRole('button', { name: /Ripristina/ }).click();
  await expect(list.getByText('Nessuna scheda archiviata.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(cardLink(page, 'Addetto vendite')).toBeVisible();
  await expect.poll(async () => (await titlesIn(page, 'Salvate')).at(-1)).toBe('Addetto vendite');
});

test('13. elimina colonna con schede: nessuna scheda viene persa, vanno spostate', async ({
  page,
}) => {
  await page.goto('/boards');
  await main(page).getByRole('link', { name: 'Ricerca autunno' }).click();
  await page.getByRole('button', { name: 'Azioni per la colonna “Inviate”' }).click();
  await page.getByRole('menuitem', { name: 'Elimina…' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Contiene 1 scheda');
  await expectNoA11yViolations(page, 'eliminazione colonna');
  await dialog.getByLabel('Sposta le schede in').selectOption({ label: 'Colloquio' });
  await dialog.getByRole('button', { name: 'Sposta ed elimina' }).click();

  await expect(column(page, 'Inviate')).toHaveCount(0);
  await expect.poll(() => titlesIn(page, 'Colloquio')).toEqual(['Magazziniere']);
  await page.reload();
  await expect.poll(() => titlesIn(page, 'Colloquio')).toEqual(['Magazziniere']);
});

test('elimina la bacheca solo dopo conferma esplicita', async ({ page }) => {
  await page.goto('/boards');
  await page.getByRole('button', { name: 'Azioni per “Lavoretti estivi”' }).click();
  await page.getByRole('menuitem', { name: 'Elimina…' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('non si può annullare');
  await confirm.getByRole('button', { name: 'Annulla' }).click();
  await expect(main(page).getByRole('link', { name: 'Lavoretti estivi' })).toBeVisible();

  await page.getByRole('button', { name: 'Azioni per “Lavoretti estivi”' }).click();
  await page.getByRole('menuitem', { name: 'Elimina…' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Elimina bacheca' }).click();
  await expect(main(page).getByRole('link', { name: 'Lavoretti estivi' })).toHaveCount(0);
  await page.reload();
  await expect(main(page).getByRole('link', { name: 'Lavoretti estivi' })).toHaveCount(0);
});

test('creazione rapida globale dalla barra superiore', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Nuova scheda/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuova scheda' });
  await dialog.getByLabel('Titolo').fill('Cassiere');
  await dialog.getByLabel('Bacheca').selectOption({ label: 'Ricerca autunno' });
  await expect(dialog.getByLabel('Colonna')).toHaveValue(/.+/);
  await dialog.getByLabel('Colonna').selectOption({ label: 'Da candidarsi' });
  await dialog.getByRole('button', { name: 'Crea scheda' }).click();
  await expect(page.getByText('Scheda “Cassiere” creata.')).toBeVisible();

  // `exact`: nell'Overview anche il link di una scheda recente contiene il nome della bacheca.
  await main(page).getByRole('link', { name: 'Ricerca autunno', exact: true }).first().click();
  await expect.poll(() => titlesIn(page, 'Da candidarsi')).toEqual(['Cassiere']);
});

test('Overview: conteggi reali, bacheche e opportunità recenti con collegamenti', async ({
  page,
}) => {
  await page.goto('/');
  const summary = page.getByRole('region', { name: 'Riepilogo' });
  await expect(summary).toContainText('Opportunità');
  // 4 schede attive (Barista, Addetto vendite, Magazziniere, Cassiere) e 2 bacheche: numeri reali.
  await expect(summary).toContainText(/Opportunità\s*4\s*Schede attive/);
  await expect(summary).toContainText(/Bacheche\s*2\s*Nel workspace/);
  await expect(page.getByRole('heading', { name: 'Opportunità recenti' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'Cassiere' })).toBeVisible();
  await expect(page.getByText('In arrivo · M1')).toHaveCount(0);
  await page.getByRole('main').getByRole('link', { name: 'Cassiere' }).click();
  await expect(page.getByRole('dialog', { name: 'Cassiere' })).toBeVisible();
  await expectNoA11yViolations(page, 'overview → dettaglio');
});

test('14. accesso negato: bacheca o scheda di un altro workspace o inesistenti → "non trovata"', async ({
  page,
  request,
}) => {
  await page.goto('/boards/00000000-0000-4000-8000-000000000000');
  await expect(page.getByRole('heading', { name: 'Bacheca non trovata' })).toBeVisible();

  // Workspace che non è dell'utente: l'API risponde come per un workspace inesistente (404).
  const res = await request.get('/api/v1/boards?workspaceId=00000000-0000-4000-8000-000000000000');
  expect(res.status()).toBe(404);
  const cards = await request.get(
    '/api/v1/cards/00000000-0000-4000-8000-000000000000?workspaceId=altro',
  );
  expect(cards.status()).toBe(404);
});
