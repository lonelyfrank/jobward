import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  cardLink,
  column,
  ensureWorkspace,
  expectNoA11yViolations,
  openTab,
  seedApi,
  smallTouchTargets,
} from './helpers';

/**
 * M2.5 — modale della candidatura e tracciamento dei colloqui. Stack reale; flusso seriale:
 * ogni test prosegue dallo stato del precedente. Date nel 2027 per restare sempre «future».
 */
test.describe.configure({ mode: 'serial' });

const BOARD = 'Colloqui M25';
let boardId = '';
const main = (page: Page) => page.getByRole('main');
const panelOf = (page: Page, title: string) => page.getByRole('dialog', { name: title });
const formOf = (panel: Locator, heading: string) =>
  panel.locator('form').filter({ has: panel.page().getByRole('heading', { name: heading }) });
const round = (panel: Locator, n: number) =>
  panel.getByRole('article', { name: new RegExp(`^Round ${n}:`) });

async function openCard(page: Page, title: string, hash = '') {
  await page.goto(`/boards/${boardId}`);
  await cardLink(page, title).click();
  const panel = panelOf(page, title);
  await expect(panel).toBeVisible();
  if (hash) await openTab(panel, hash);
  return panel;
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await ensureWorkspace(page);
  const api = await seedApi(page);
  const board = await api.board(BOARD);
  boardId = board.id;
  await api.card(board.columns[0]!.id, 'Infermiere Colloqui', {
    company: 'Clinica Nord',
    location: 'Brescia',
    workMode: 'onsite',
  });
  await api.card(board.columns[0]!.id, 'Cuoco Colloqui', { company: 'Trattoria Sud' });
  await page.close();
});

test('1. desktop: modale centrata, larga al massimo 1000 px, con intestazione, schede e riepilogo', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1360, height: 800 });
  const panel = await openCard(page, 'Infermiere Colloqui');
  const box = (await panel.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(1000.5);
  expect(box.height).toBeLessThanOrEqual(720.5);
  expect(Math.abs(box.x + box.width / 2 - 680)).toBeLessThan(2);
  // Intestazione: azienda, stato corrente; schede; riepilogo con soli dati registrati.
  await expect(panel.getByText('Clinica Nord')).toBeVisible();
  await expect(panel.getByRole('list', { name: 'Stato della candidatura' })).toContainText(
    'Fase non indicata',
  );
  await expect(
    panel.getByRole('tablist', { name: 'Sezioni della candidatura' }).getByRole('tab'),
  ).toHaveText(['Panoramica', 'Colloqui', 'Dettagli', 'Cronologia']);
  const summary = panel.getByRole('region', { name: 'Riepilogo' });
  await expect(summary.getByText('Nessun colloquio programmato.')).toBeVisible();
  await expect(summary.getByText('Nessuna azione in sospeso.')).toBeVisible();
  await expect(summary.getByText('Brescia · In presenza')).toBeVisible();
  await expectNoA11yViolations(page, 'modale — Panoramica');
});

test("2. schede: la scheda attiva è nell'indirizzo, la tastiera le scorre, Esc e «indietro» chiudono e il focus torna alla scheda", async ({
  page,
}) => {
  const panel = await openCard(page, 'Infermiere Colloqui');
  await panel.getByRole('tab', { name: 'Colloqui' }).click();
  await expect(page).toHaveURL(/\/cards\/[0-9a-f-]{36}#colloqui$/);
  await expect(panel.getByText('Nessun colloquio registrato')).toBeVisible();
  await expectNoA11yViolations(page, 'modale — Colloqui (vuota)');

  // Frecce: spostano la selezione tra le schede (Radix), con l'indirizzo che le segue.
  await panel.getByRole('tab', { name: 'Colloqui' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(panel.getByRole('tab', { name: 'Dettagli' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.reload();
  await expect(
    panelOf(page, 'Infermiere Colloqui').getByRole('tab', { name: 'Dettagli' }),
  ).toHaveAttribute('aria-selected', 'true');

  // Escape: chiude (nessuna modifica) e il focus torna al link della scheda.
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/boards/${boardId}$`));
  await expect(cardLink(page, 'Infermiere Colloqui')).toBeFocused();

  // «Indietro» chiude la modale.
  await cardLink(page, 'Infermiere Colloqui').click();
  await expect(panel).toBeVisible();
  await page.goBack();
  await expect(panel).toBeHidden();
});

test('3. aggiunge un colloquio senza data: «da programmare», prossima azione derivata, la scheda non cambia', async ({
  page,
}) => {
  const panel = await openCard(page, 'Infermiere Colloqui', 'Colloqui');
  await panel.getByRole('button', { name: 'Aggiungi colloquio' }).click();
  const form = formOf(panel, 'Nuovo colloquio');
  await expect(form.getByLabel('Titolo')).toHaveAttribute('placeholder', 'Round 1');
  await form.getByLabel('Tipo di colloquio').selectOption('screening');
  await form.getByRole('button', { name: 'Aggiungi colloquio' }).click();
  await expect(page.getByText('Colloquio aggiunto.', { exact: true })).toBeVisible();

  const r1 = round(panel, 1);
  await expect(r1).toContainText('Da programmare');
  await expect(r1).toContainText('Primo contatto / screening');
  // Nessun automatismo: fase ed esito generali restano non indicati.
  await openTab(panel, 'Panoramica');
  await expect(panel.getByLabel('Fase', { exact: true })).toHaveValue('');
  await expect(panel.getByLabel('Esito', { exact: true })).toHaveValue('');
  const summary = panel.getByRole('region', { name: 'Riepilogo' });
  await expect(summary.getByText('Programma “Round 1”')).toBeVisible();
  await expect(panel.getByRole('list', { name: 'Stato della candidatura' })).not.toContainText(
    'Colloquio',
  );
  await page.keyboard.press('Escape');
  // Kanban: la scheda mostra la prossima azione; è ancora nella stessa colonna.
  const card = page
    .locator('[data-card-id]')
    .filter({ has: cardLink(page, 'Infermiere Colloqui') });
  await expect(card.getByText('Programma “Round 1”')).toBeVisible();
  await expect(
    column(page, 'Da fare').getByRole('link', { name: 'Infermiere Colloqui' }),
  ).toBeVisible();
});

test('4. programma e riprogramma: stato «programmato», prossimo colloquio su riepilogo e Kanban, cronologia', async ({
  page,
}) => {
  const panel = await openCard(page, 'Infermiere Colloqui', 'Colloqui');
  await round(panel, 1).getByRole('button', { name: 'Programma', exact: true }).click();
  const when = panel.getByLabel('Nuova data e ora');
  await when.fill('2027-03-10T15:30');
  await panel.getByRole('button', { name: 'Salva la data' }).click();
  await expect(page.getByText('Colloquio programmato.', { exact: true })).toBeVisible();
  await expect(round(panel, 1)).toContainText('Programmato');
  await expect(round(panel, 1)).toContainText('10 marzo 2027');
  await expect(round(panel, 1)).toContainText('15:30');

  await round(panel, 1).getByRole('button', { name: 'Riprogramma' }).click();
  await panel.getByLabel('Nuova data e ora').fill('2027-03-12T09:00');
  await panel.getByRole('button', { name: 'Salva la data' }).click();
  await expect(round(panel, 1)).toContainText('12 marzo 2027');

  await openTab(panel, 'Panoramica');
  await expect(
    panel.getByRole('region', { name: 'Riepilogo' }).getByText(/12 marzo 2027/),
  ).toBeVisible();
  await openTab(panel, 'Cronologia');
  await expect(panel.getByText(/Round 1 riprogrammato per 12 mar/)).toBeVisible();
  await expect(panel.getByText(/Round 1 programmato per 10 mar/)).toBeVisible();
  await page.keyboard.press('Escape');
  const card = page
    .locator('[data-card-id]')
    .filter({ has: cardLink(page, 'Infermiere Colloqui') });
  await expect(card.getByText(/12 mar/)).toBeVisible();
});

test("5. completa con esito e feedback: nessuna modifica automatica dell'esito della candidatura", async ({
  page,
}) => {
  const panel = await openCard(page, 'Infermiere Colloqui', 'Colloqui');
  await round(panel, 1).getByRole('button', { name: 'Segna come completato' }).click();
  const form = formOf(panel, 'Completa il colloquio');
  await form.getByLabel('Come è andato').selectOption('positive');
  await form.getByLabel('Feedback e appunti').fill('Buona intesa con la coordinatrice.');
  await form.getByRole('button', { name: 'Segna come completato' }).click();
  await expect(page.getByText('Colloquio completato.', { exact: true })).toBeVisible();
  const r1 = round(panel, 1);
  await expect(r1).toContainText('Completato');
  await expect(r1).toContainText('Esito: positivo');
  await expect(r1).toContainText('Buona intesa con la coordinatrice.');

  await openTab(panel, 'Panoramica');
  await expect(panel.getByLabel('Esito', { exact: true })).toHaveValue(''); // l'esito generale non si muove
  await expect(panel.getByLabel('Fase', { exact: true })).toHaveValue('');
  await expect(
    panel.getByRole('region', { name: 'Riepilogo' }).getByText('Nessun colloquio programmato.'),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  const card = page
    .locator('[data-card-id]')
    .filter({ has: cardLink(page, 'Infermiere Colloqui') });
  await expect(card.getByText(/12 mar/)).toHaveCount(0); // non è più il «prossimo»
});

test('6. fase successiva: il round precedente resta; più colloqui; uno annullato non è il prossimo', async ({
  page,
}) => {
  const panel = await openCard(page, 'Infermiere Colloqui', 'Colloqui');
  await round(panel, 1).getByRole('button', { name: 'Aggiungi fase successiva' }).click();
  const form = formOf(panel, 'Nuova fase successiva');
  await form.getByLabel('Titolo').fill('Colloquio con la direzione');
  await form.getByLabel('Tipo di colloquio').selectOption('final');
  await form.getByLabel('Data e ora').fill('2027-03-20T11:00');
  await form.getByLabel('Durata (minuti)').fill('45');
  await form.getByLabel('Modalità', { exact: true }).selectOption('video');
  await form.getByLabel('Collegamento alla riunione').fill('https://meet.example.com/direzione');
  await form.getByLabel('Chi conduce il colloquio').fill('Dott.ssa Bianchi\nDott. Verdi');
  await form.getByRole('button', { name: 'Aggiungi colloquio' }).click();
  await expect(page.getByText('Fase successiva aggiunta.', { exact: true })).toBeVisible();
  const r2 = round(panel, 2);
  await expect(r2).toContainText('Colloquio con la direzione');
  await expect(r2).toContainText('Videochiamata');
  await expect(r2).toContainText('45 min');
  await expect(r2).toContainText('Dott.ssa Bianchi, Dott. Verdi');
  await expect(r2.getByRole('link', { name: /Apri la riunione/ })).toHaveAttribute(
    'href',
    'https://meet.example.com/direzione',
  );
  await expect(round(panel, 1)).toContainText('Completato'); // il precedente non è stato toccato

  // Un terzo round, poi annullato: resta nello storico ma non compare come prossimo.
  await panel.getByRole('button', { name: 'Aggiungi colloquio' }).click();
  const third = formOf(panel, 'Nuovo colloquio');
  await third.getByLabel('Data e ora').fill('2027-03-15T10:00');
  await third.getByRole('button', { name: 'Aggiungi colloquio' }).click();
  await expect(round(panel, 3)).toContainText('Programmato');
  await openTab(panel, 'Panoramica');
  await expect(
    panel.getByRole('region', { name: 'Riepilogo' }).getByText(/15 marzo 2027/),
  ).toBeVisible(); // il più vicino
  await openTab(panel, 'Colloqui');
  await round(panel, 3).getByRole('button', { name: 'Annulla il colloquio' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('Non cambia la fase né l’esito');
  await confirm.getByRole('button', { name: 'Mantieni il colloquio' }).click();
  await expect(round(panel, 3)).toContainText('Programmato');
  await round(panel, 3).getByRole('button', { name: 'Annulla il colloquio' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Annulla il colloquio' }).click();
  await expect(round(panel, 3)).toContainText('Annullato');
  await openTab(panel, 'Panoramica');
  await expect(
    panel.getByRole('region', { name: 'Riepilogo' }).getByText(/20 marzo 2027/),
  ).toBeVisible(); // ora il prossimo è il round 2
  await expect(
    panel.getByRole('region', { name: 'Riepilogo' }).getByText(/15 marzo 2027/),
  ).toHaveCount(0);
  await expectNoA11yViolations(page, 'modale — Panoramica con colloqui');
});

test('7. suggerimento di fase esplicito; fase e colonna non cambiano da sole', async ({ page }) => {
  const panel = await openCard(page, 'Infermiere Colloqui', 'Colloqui');
  const hint = panel.getByText(/Ci sono colloqui, ma la fase è/);
  await expect(hint).toBeVisible();
  await expect(panel.getByRole('list', { name: 'Stato della candidatura' })).not.toContainText(
    'Colloquio',
  );
  await panel.getByRole('button', { name: 'Imposta la fase «Colloquio»' }).click();
  await expect(page.getByText('Fase impostata su “Colloquio”.')).toBeVisible();
  await expect(panel.getByRole('list', { name: 'Stato della candidatura' })).toContainText(
    'Colloquio',
  );
  await expect(hint).toHaveCount(0);
  await openTab(panel, 'Panoramica');
  await expect(panel.getByLabel('Fase', { exact: true })).toHaveValue('interviewing');
  await expect(panel.getByLabel('Esito', { exact: true })).toHaveValue('');
});

test('8. aggiornamento rapido della fase dal riepilogo; la bozza di un campo in modifica non viene sovrascritta', async ({
  page,
}) => {
  const panel = await openCard(page, 'Infermiere Colloqui');
  await panel.getByLabel('Azienda o ente').fill('Clinica Nord SpA'); // bozza non salvata
  await panel.getByLabel('Passaggio del percorso').selectOption('offer');
  await panel.getByRole('button', { name: 'Aggiorna', exact: true }).click();
  await expect(page.getByText('Fase impostata su “Offerta”.')).toBeVisible();
  await expect(panel.getByLabel('Fase', { exact: true })).toHaveValue('offer'); // segue il valore salvato
  await expect(panel.getByLabel('Azienda o ente')).toHaveValue('Clinica Nord SpA'); // la bozza resta
  await expect(panel.getByText('Modifiche non salvate')).toBeVisible();
  await panel.getByRole('button', { name: 'Annulla modifiche' }).click();
  await expect(panel.getByLabel('Azienda o ente')).toHaveValue('Clinica Nord');
  await panel.getByLabel('Passaggio del percorso').selectOption('interviewing');
  await panel.getByRole('button', { name: 'Aggiorna', exact: true }).click();
  await expect(panel.getByLabel('Fase', { exact: true })).toHaveValue('interviewing');
});

test('9. feedback aggiunto e modificato dopo il completamento; tutto persiste dopo il refresh', async ({
  page,
}) => {
  const panel = await openCard(page, 'Infermiere Colloqui', 'Colloqui');
  await round(panel, 2).getByRole('button', { name: 'Segna come completato' }).click();
  await formOf(panel, 'Completa il colloquio')
    .getByRole('button', { name: 'Segna come completato' })
    .click();
  await expect(round(panel, 2)).toContainText('Completato');
  await expect(round(panel, 2)).not.toContainText('Esito:');
  // Il riepilogo segnala il feedback mancante.
  await openTab(panel, 'Panoramica');
  await expect(
    panel
      .getByRole('region', { name: 'Riepilogo' })
      .getByText('Registra il feedback di “Colloquio con la direzione”'),
  ).toBeVisible();
  await openTab(panel, 'Colloqui');
  await round(panel, 2).getByRole('button', { name: 'Aggiungi feedback' }).click();
  const fb = formOf(panel, 'Feedback');
  await fb.getByLabel('Come è andato').selectOption('neutral');
  await fb.getByLabel('Feedback e appunti').fill('Attendo risposta entro venerdì.');
  await fb.getByRole('button', { name: 'Salva feedback' }).click();
  await expect(page.getByText('Feedback salvato.', { exact: true })).toBeVisible();
  await expect(round(panel, 2)).toContainText('Esito: neutro');

  await page.reload();
  const again = panelOf(page, 'Infermiere Colloqui');
  await expect(round(again, 1)).toContainText('Esito: positivo');
  await expect(round(again, 2)).toContainText('Attendo risposta entro venerdì.');
  await expect(round(again, 3)).toContainText('Annullato');
  await openTab(again, 'Panoramica');
  await expect(
    again.getByRole('region', { name: 'Riepilogo' }).getByText('Nessuna azione in sospeso.'),
  ).toBeVisible();
  await openTab(again, 'Cronologia');
  for (const text of [
    /Colloquio aggiunto: Round 1/,
    /Fase successiva aggiunta: Round 2/,
    /Round 1 completato, esito positivo/,
    /Feedback registrato per Round 2/,
    /Round 3 annullato/,
  ]) {
    await expect(again.getByText(text)).toBeVisible();
  }
  // Mai il testo delle note nella cronologia.
  await expect(again.getByText('Attendo risposta')).toHaveCount(1); // solo nel round, non negli eventi
});

test('10. Kanban: densità informativa e compatta (preferenza locale) con il prossimo colloquio', async ({
  page,
}) => {
  const api = await seedApi(page);
  void api;
  await page.goto(`/boards/${boardId}`);
  const card = page
    .locator('[data-card-id]')
    .filter({ has: cardLink(page, 'Infermiere Colloqui') });
  await expect(card.getByText('Clinica Nord · Brescia · In presenza')).toBeVisible(); // informativa (predefinita)
  await page
    .getByRole('group', { name: 'Densità delle schede' })
    .getByRole('button', { name: 'Compatta' })
    .click();
  await expect(card.getByText('Clinica Nord', { exact: true })).toBeVisible();
  await expect(card.getByText('In presenza')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Compatta' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Informativa' }).click();
  await expect(page.getByRole('button', { name: 'Informativa' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('11. modifiche non salvate: la chiusura chiede conferma, «torna alla scheda» conserva la bozza', async ({
  page,
}) => {
  const panel = await openCard(page, 'Cuoco Colloqui');
  await panel.getByLabel('Azienda o ente').fill('Modificata senza salvare');
  await page.keyboard.press('Escape');
  const confirm = page.getByRole('alertdialog', { name: 'Hai modifiche non salvate' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Torna alla scheda' }).click();
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel('Azienda o ente')).toHaveValue('Modificata senza salvare');
  await page.keyboard.press('Escape');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Esci senza salvare' }).click();
  await expect(panel).toBeHidden();
  // Anche «indietro» è intercettato; e dopo l'uscita la bozza non c'è più.
  await cardLink(page, 'Cuoco Colloqui').click();
  await expect(panelOf(page, 'Cuoco Colloqui').getByLabel('Azienda o ente')).toHaveValue(
    'Trattoria Sud',
  );
  await panelOf(page, 'Cuoco Colloqui').getByLabel('Azienda o ente').fill('Altra bozza');
  await page.goBack();
  await expect(page.getByRole('alertdialog', { name: 'Hai modifiche non salvate' })).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Torna alla scheda' }).click();
  await expect(panelOf(page, 'Cuoco Colloqui')).toBeVisible();
  // Una bozza di colloquio non salvata conta come modifica non salvata.
  await panelOf(page, 'Cuoco Colloqui').getByLabel('Azienda o ente').fill('Trattoria Sud');
  await openTab(panelOf(page, 'Cuoco Colloqui'), 'Colloqui');
  await panelOf(page, 'Cuoco Colloqui').getByRole('button', { name: 'Aggiungi colloquio' }).click();
  await formOf(panelOf(page, 'Cuoco Colloqui'), 'Nuovo colloquio')
    .getByLabel('Titolo')
    .fill('Bozza di round');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog', { name: 'Hai modifiche non salvate' })).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Esci senza salvare' }).click();
  await expect(panelOf(page, 'Cuoco Colloqui')).toBeHidden();
});

test('12. candidatura archiviata: lo storico dei colloqui si conserva e si legge, le modifiche richiedono il ripristino', async ({
  page,
}) => {
  const panel = await openCard(page, 'Infermiere Colloqui');
  await panel.getByRole('button', { name: 'Archivia' }).click();
  await expect(panel).toBeHidden();
  // Apertura diretta dall'indirizzo della candidatura archiviata.
  const archived = await (
    await page.request.get(
      `/api/v1/boards/${boardId}/archived?workspaceId=${(await (await page.request.get('/api/v1/me')).json()).workspaces[0].id}`,
    )
  ).json();
  const id = archived.cards[0].id as string;
  await page.goto(`/boards/${boardId}/cards/${id}#colloqui`);
  const view = panelOf(page, 'Infermiere Colloqui');
  await expect(view.getByText(/archiviata: lo storico dei colloqui si conserva/)).toBeVisible();
  await expect(round(view, 1)).toContainText('Esito: positivo');
  await expect(round(view, 2)).toContainText('Attendo risposta entro venerdì.');
  await expect(view.getByRole('button', { name: 'Aggiungi colloquio' })).toHaveCount(0);
  await expect(round(view, 2).getByRole('button')).toHaveCount(0);
  await view.getByRole('button', { name: 'Ripristina scheda' }).click();
  await expect(page.getByText('Scheda ripristinata.')).toBeVisible();
  await expect(view.getByRole('button', { name: 'Aggiungi colloquio' })).toBeVisible();
});

test('13. dalla Tabella e da Opportunità la stessa modale si apre sulla stessa rotta e restituisce il focus', async ({
  page,
}) => {
  await page.goto(`/boards/${boardId}/table?q=infermiere`);
  const link = page.getByRole('link', { name: 'Infermiere Colloqui', exact: true });
  await link.click();
  const panel = panelOf(page, 'Infermiere Colloqui');
  await expect(panel).toBeVisible();
  await openTab(panel, 'Colloqui');
  await expect(round(panel, 2)).toContainText('Colloquio con la direzione');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(new RegExp(`/boards/${boardId}/table\\?q=infermiere$`));
  await expect(link).toBeFocused();
  await page.goto('/opportunities?q=infermiere');
  await page.getByRole('link', { name: 'Infermiere Colloqui', exact: true }).click();
  await expect(panelOf(page, 'Infermiere Colloqui')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/opportunities\?q=infermiere$/);
});

test('14. un altro workspace non raggiunge i colloqui (404 sulle API)', async ({ page }) => {
  const me = await (await page.request.get('/api/v1/me')).json();
  const ws = me.workspaces[0].id as string;
  const board = await (
    await page.request.get(`/api/v1/boards/${boardId}?workspaceId=${ws}`)
  ).json();
  const cardId = board.cards[0].id as string;
  expect(
    (await page.request.get(`/api/v1/cards/${cardId}/interviews?workspaceId=inesistente`)).status(),
  ).toBe(404);
  expect(
    (
      await page.request.post(`/api/v1/interviews/inesistente/cancel?workspaceId=${ws}`, {
        data: {},
      })
    ).status(),
  ).toBe(404);
});

test('15. telefono (390 px): modale a schermo intero, schede scorrevoli, colloquio creabile, aree di tocco ≥ 44 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = await openCard(page, 'Cuoco Colloqui');
  const box = (await panel.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(388);
  expect(box.height).toBeGreaterThanOrEqual(840);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
  const list = panel.getByRole('tablist');
  expect(await list.evaluate((el) => el.scrollWidth >= el.clientWidth)).toBe(true);
  await openTab(panel, 'Colloqui');
  await panel.getByRole('button', { name: 'Aggiungi colloquio' }).click();
  const form = formOf(panel, 'Nuovo colloquio');
  await form.getByLabel('Titolo').fill('Prova pratica');
  await form.getByLabel('Data e ora').fill('2027-04-02T14:00');
  await expectNoA11yViolations(page, 'modale — nuovo colloquio a 390 px');
  expect(await smallTouchTargets(page, '[role=dialog]')).toEqual([]);
  await form.getByRole('button', { name: 'Aggiungi colloquio' }).click();
  await expect(round(panel, 1)).toContainText('Prova pratica');
  await expect(round(panel, 1)).toContainText('Programmato');
  await openTab(panel, 'Panoramica');
  expect(await smallTouchTargets(page, '[role=dialog]')).toEqual([]);
  await page.getByRole('button', { name: 'Chiudi' }).click();
  await expect(panel).toBeHidden();
});

test('16. tema scuro: modale con schede e colloqui senza violazioni di accessibilità', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const panel = await openCard(page, 'Infermiere Colloqui', 'Colloqui');
  await expect(round(panel, 1)).toBeVisible();
  await expectNoA11yViolations(page, 'modale — Colloqui (scuro)');
  await openTab(panel, 'Cronologia');
  await expectNoA11yViolations(page, 'modale — Cronologia (scuro)');
});
