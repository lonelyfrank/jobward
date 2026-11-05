import { expect, test, type Page } from '@playwright/test';
import {
  cardLink,
  column,
  createBoard,
  ensureWorkspace,
  expectNoA11yViolations,
  openSection,
  quickAdd,
  smallTouchTargets,
} from './helpers';

/** M2.2 — campi personalizzati ed etichette, su stack reale. Serial: ogni test prosegue dal precedente. */
test.describe.configure({ mode: 'serial' });

const BOARD = 'Sanità M2';
const main = (page: Page) => page.getByRole('main');
const panelOf = (page: Page, title: string) => page.getByRole('dialog', { name: title });

async function openBoard(page: Page) {
  await page.goto('/boards');
  await main(page).getByRole('link', { name: BOARD }).click();
  await expect(page.getByRole('heading', { level: 1, name: BOARD })).toBeVisible();
}

async function openConfigurator(page: Page) {
  await page.getByRole('button', { name: 'Azioni bacheca' }).click();
  await page.getByRole('menuitem', { name: 'Campi personalizzati…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Campi personalizzati' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function addField(
  dialog: ReturnType<Page['getByRole']>,
  page: Page,
  name: string,
  type: string,
  options: string[] = [],
) {
  await dialog.getByRole('button', { name: 'Aggiungi campo' }).click();
  const form = page.getByRole('dialog', { name: 'Nuovo campo' });
  await form.getByLabel('Nome del campo').fill(name);
  await form.getByLabel('Tipo di informazione').selectOption({ label: type });
  for (const [i, option] of options.entries()) {
    if (i >= 2) await form.getByRole('button', { name: 'Aggiungi opzione' }).click();
    await form.getByLabel(`Opzione ${i + 1}`, { exact: true }).fill(option);
  }
  await form.getByRole('button', { name: 'Crea campo' }).click();
  await expect(page.getByRole('dialog', { name: 'Campi personalizzati' })).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Campi della bacheca' }).getByText(name, { exact: true }),
  ).toBeVisible();
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await ensureWorkspace(page);
  await page.close();
});

test('1. configuratore: stato vuoto, validazione, creazione di campi di tipi diversi con anteprima', async ({
  page,
}) => {
  await createBoard(page, BOARD, 'Minimal');
  await quickAdd(page, 'Da fare', 'Operatore sociosanitario');
  const dialog = await openConfigurator(page);
  await expect(dialog.getByText('Nessun campo.')).toBeVisible();
  await expectNoA11yViolations(page, 'configuratore vuoto');

  // Validazione: nome vuoto; opzioni vuote o duplicate.
  await dialog.getByRole('button', { name: 'Aggiungi campo' }).click();
  const form = page.getByRole('dialog', { name: 'Nuovo campo' });
  await form.getByRole('button', { name: 'Crea campo' }).click();
  await expect(form.getByText('Scrivi il nome del campo')).toBeVisible();
  await form.getByLabel('Nome del campo').fill('Turni');
  await form.getByLabel('Tipo di informazione').selectOption({ label: 'Scelta singola' });
  await form.getByRole('button', { name: 'Crea campo' }).click();
  await expect(form.getByText('Ogni opzione deve avere un nome')).toBeVisible();
  await form.getByLabel('Opzione 1', { exact: true }).fill('Giorno');
  await form.getByLabel('Opzione 2', { exact: true }).fill('giorno');
  await form.getByRole('button', { name: 'Crea campo' }).click();
  await expect(form.getByText('Due opzioni hanno lo stesso nome')).toBeVisible();

  // L'anteprima mostra il controllo reale con le opzioni digitate.
  await form.getByLabel('Opzione 2', { exact: true }).fill('Notte');
  const preview = form.getByRole('region', { name: 'Anteprima' });
  await expect(preview.getByLabel('Turni')).toBeVisible();
  await expect(preview.getByRole('option', { name: 'Notte' })).toHaveCount(1);
  await expectNoA11yViolations(page, 'modulo campo');
  await form.getByRole('button', { name: 'Annulla' }).click();

  await addField(
    page.getByRole('dialog', { name: 'Campi personalizzati' }),
    page,
    'Turni',
    'Scelta singola',
    ['Giorno', 'Notte', 'Festivi'],
  );
  await addField(
    page.getByRole('dialog', { name: 'Campi personalizzati' }),
    page,
    'Iscrizione albo',
    'Sì / No',
  );
  await addField(
    page.getByRole('dialog', { name: 'Campi personalizzati' }),
    page,
    'Reparto',
    'Testo breve',
  );
  await addField(
    page.getByRole('dialog', { name: 'Campi personalizzati' }),
    page,
    'Disponibilità',
    'Scelta multipla',
    ['Weekend', 'Notti'],
  );
  await expect(page.getByText('4 di 30 campi')).toBeVisible();

  // Nome duplicato nella stessa bacheca → messaggio comprensibile.
  const list = page.getByRole('dialog', { name: 'Campi personalizzati' });
  await list.getByRole('button', { name: 'Aggiungi campo' }).click();
  const dup = page.getByRole('dialog', { name: 'Nuovo campo' });
  await dup.getByLabel('Nome del campo').fill('reparto');
  await dup.getByRole('button', { name: 'Crea campo' }).click();
  await expect(dup.getByRole('alert')).toContainText('esiste già un campo con questo nome');
  await dup.getByRole('button', { name: 'Annulla' }).click();
  await expectNoA11yViolations(page, 'configuratore con campi');
});

test('2. il riordino dei campi persiste', async ({ page }) => {
  await openBoard(page);
  const dialog = await openConfigurator(page);
  const names = () =>
    dialog
      .getByRole('list', { name: 'Campi della bacheca' })
      .locator('li p:first-child span')
      .allTextContents();
  await expect.poll(names).toEqual(['Turni', 'Iscrizione albo', 'Reparto', 'Disponibilità']);
  await dialog.getByRole('button', { name: 'Sposta su “Reparto”' }).click();
  await expect.poll(names).toEqual(['Turni', 'Reparto', 'Iscrizione albo', 'Disponibilità']);
  await page.reload();
  const again = await openConfigurator(page);
  await expect
    .poll(() =>
      again
        .getByRole('list', { name: 'Campi della bacheca' })
        .locator('li p:first-child span')
        .allTextContents(),
    )
    .toEqual(['Turni', 'Reparto', 'Iscrizione albo', 'Disponibilità']);
});

test('3. si assegnano valori di ogni tipo dal pannello e persistono dopo il refresh', async ({
  page,
}) => {
  await openBoard(page);
  await cardLink(page, 'Operatore sociosanitario').click();
  const panel = panelOf(page, 'Operatore sociosanitario');
  await openSection(panel, 'Campi personalizzati');
  await panel.getByLabel('Turni', { exact: true }).selectOption({ label: 'Notte' });
  await panel.getByLabel('Iscrizione albo').selectOption('true');
  await panel.getByLabel('Reparto').fill('Geriatria');
  await panel.getByRole('group', { name: 'Disponibilità' }).getByLabel('Notti').check();
  await expectNoA11yViolations(page, 'pannello con campi personalizzati');
  await panel.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Modifiche salvate.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Salva' })).toBeDisabled();

  await page.reload();
  const again = panelOf(page, 'Operatore sociosanitario');
  await expect(again.getByLabel('Turni', { exact: true })).toHaveValue(/.+/);
  await expect(again.getByLabel('Turni', { exact: true }).locator('option:checked')).toHaveText(
    'Notte',
  );
  await expect(again.getByLabel('Iscrizione albo')).toHaveValue('true');
  await expect(again.getByLabel('Reparto')).toHaveValue('Geriatria');
  await expect(
    again.getByRole('group', { name: 'Disponibilità' }).getByLabel('Notti'),
  ).toBeChecked();
  await expect(
    again.getByRole('group', { name: 'Disponibilità' }).getByLabel('Weekend'),
  ).not.toBeChecked();
});

test('4. disattivare nasconde il campo senza perdere il valore; riattivare lo riporta', async ({
  page,
}) => {
  await openBoard(page);
  const dialog = await openConfigurator(page);
  await dialog.getByRole('button', { name: 'Disattiva “Reparto”' }).click();
  await expect(
    page.getByText('Campo “Reparto” disattivato: i valori sono conservati.'),
  ).toBeVisible();
  await expect(dialog.getByText('Disattivato')).toBeVisible();
  await page.keyboard.press('Escape');

  await cardLink(page, 'Operatore sociosanitario').click();
  const panel = panelOf(page, 'Operatore sociosanitario');
  await openSection(panel, 'Campi personalizzati');
  await expect(panel.getByLabel('Reparto')).toHaveCount(0);
  await expect(panel.getByLabel('Iscrizione albo')).toBeVisible();
  await page.keyboard.press('Escape');

  const again = await openConfigurator(page);
  await again.getByRole('button', { name: 'Riattiva “Reparto”' }).click();
  await expect(again.getByText('Disattivato')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await cardLink(page, 'Operatore sociosanitario').click();
  const reopened = panelOf(page, 'Operatore sociosanitario');
  await openSection(reopened, 'Campi personalizzati');
  await expect(reopened.getByLabel('Reparto')).toHaveValue('Geriatria'); // il valore era rimasto
});

test('5. rinominare un’opzione conserva il valore; un’opzione in uso non si può rimuovere', async ({
  page,
}) => {
  await openBoard(page);
  const dialog = await openConfigurator(page);
  await dialog.getByRole('button', { name: 'Modifica “Turni”' }).click();
  const form = page.getByRole('dialog', { name: 'Modifica campo' });
  await expect(form.getByLabel('Tipo di informazione')).toBeDisabled();
  await expect(form.getByText('Il tipo non si può cambiare dopo la creazione')).toBeVisible();
  await form.getByLabel('Opzione 2', { exact: true }).fill('Notturno');
  await form.getByRole('button', { name: 'Salva campo' }).click();
  await expect(page.getByText('Campo aggiornato.')).toBeVisible();

  // Rimuovere "Notturno" (usata dalla scheda) è rifiutato con un messaggio chiaro.
  await dialog.getByRole('button', { name: 'Modifica “Turni”' }).click();
  const again = page.getByRole('dialog', { name: 'Modifica campo' });
  await again.getByRole('button', { name: 'Rimuovi l’opzione 2' }).click();
  await again.getByRole('button', { name: 'Salva campo' }).click();
  await expect(again.getByRole('alert')).toContainText(
    'non è compatibile con i valori già inseriti in 1 scheda',
  );
  await again.getByRole('button', { name: 'Annulla' }).click();
  await page.keyboard.press('Escape');

  await cardLink(page, 'Operatore sociosanitario').click();
  const panel = panelOf(page, 'Operatore sociosanitario');
  await openSection(panel, 'Campi personalizzati');
  await expect(panel.getByLabel('Turni', { exact: true }).locator('option:checked')).toHaveText(
    'Notturno',
  );
});

test('6. validazione dei valori: un numero non valido è segnalato accanto al campo', async ({
  page,
}) => {
  await openBoard(page);
  const dialog = await openConfigurator(page);
  await addField(dialog, page, 'Anni di esperienza', 'Numero');
  await page.keyboard.press('Escape');
  await cardLink(page, 'Operatore sociosanitario').click();
  const panel = panelOf(page, 'Operatore sociosanitario');
  await openSection(panel, 'Campi personalizzati');
  await panel.getByLabel('Anni di esperienza').fill('molti');
  await panel.getByRole('button', { name: 'Salva' }).click();
  await expect(panel.getByText('Inserisci un numero')).toBeVisible();
  await expect(panel.getByLabel('Anni di esperienza')).toHaveAttribute('aria-invalid', 'true');
  await panel.getByLabel('Anni di esperienza').fill('7,5');
  await panel.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Modifiche salvate.')).toBeVisible();
  await page.reload();
  await expect(
    panelOf(page, 'Operatore sociosanitario').getByLabel('Anni di esperienza'),
  ).toHaveValue('7.5');
});

test('7. eliminare un campo con valori chiede conferma esplicita e dice quante schede coinvolge', async ({
  page,
}) => {
  await openBoard(page);
  const dialog = await openConfigurator(page);
  await dialog.getByRole('button', { name: 'Elimina “Anni di esperienza”' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('1 scheda');
  await expect(confirm).toContainText('Se vuoi solo nasconderlo, usa “Disattiva”');
  // Annulla: nulla cambia.
  await confirm.getByRole('button', { name: 'Annulla' }).click();
  await expect(dialog.getByText('Anni di esperienza', { exact: true })).toBeVisible();
  // Conferma: il campo e i suoi valori spariscono, la scheda resta.
  await dialog.getByRole('button', { name: 'Elimina “Anni di esperienza”' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Elimina campo e valori' })
    .click();
  await expect(dialog.getByText('Anni di esperienza', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await dialog.getByRole('button', { name: 'Chiudi' }).click();
  await expect(dialog).toBeHidden();
  await expect(cardLink(page, 'Operatore sociosanitario')).toBeVisible();
});

test('8. etichette: si creano dalla scheda, compaiono sul Kanban e si rimuovono', async ({
  page,
}) => {
  await openBoard(page);
  await cardLink(page, 'Operatore sociosanitario').click();
  const panel = panelOf(page, 'Operatore sociosanitario');
  await expect(panel.getByText('Nessuna etichetta.')).toBeVisible();
  await panel.getByRole('button', { name: 'Aggiungi etichetta' }).click();
  await panel.getByLabel('Nuova etichetta').fill('Estero');
  await panel.getByRole('radio', { name: 'Verde' }).check({ force: true });
  await panel.getByRole('button', { name: 'Crea e assegna' }).click();
  await expect(
    panel.getByRole('list', { name: 'Etichette assegnate' }).getByText('Estero'),
  ).toBeVisible();

  await panel.getByLabel('Nuova etichetta').fill('estero');
  await panel.getByRole('button', { name: 'Crea e assegna' }).click();
  await expect(panel.getByText('Esiste già un’etichetta con questo nome')).toBeVisible();
  await panel.getByLabel('Nuova etichetta').fill('Part-time');
  await panel.getByRole('button', { name: 'Crea e assegna' }).click();
  await expect(
    panel.getByRole('list', { name: 'Etichette assegnate' }).getByText('Part-time'),
  ).toBeVisible();
  await expectNoA11yViolations(page, 'pannello con etichette');

  await page.keyboard.press('Escape');
  const card = column(page, 'Da fare')
    .locator('[data-card-id]')
    .filter({ has: cardLink(page, 'Operatore sociosanitario') });
  await expect(card.getByText('Estero')).toBeVisible();
  await expect(card.getByText('Part-time')).toBeVisible();

  await page.reload();
  await expect(column(page, 'Da fare').getByText('Estero')).toBeVisible();
  await cardLink(page, 'Operatore sociosanitario').click();
  await panelOf(page, 'Operatore sociosanitario')
    .getByRole('button', { name: 'Rimuovi l’etichetta Part-time' })
    .click();
  await expect(
    panelOf(page, 'Operatore sociosanitario')
      .getByRole('list', { name: 'Etichette assegnate' })
      .getByText('Part-time'),
  ).toHaveCount(0);
});

test('9. impostazioni: rinomina, colore ed eliminazione controllata delle etichette', async ({
  page,
}) => {
  await page.goto('/settings');
  const list = page.getByRole('list', { name: 'Etichette', exact: true });
  await expect(list.getByText('Estero', { exact: true })).toBeVisible();
  await expect(list.getByText('1 scheda')).toBeVisible();
  await expectNoA11yViolations(page, 'impostazioni con etichette');

  await page.getByRole('button', { name: 'Modifica l’etichetta Estero' }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Estero (UE)');
  await page.getByRole('radio', { name: 'Blu' }).last().check({ force: true });
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.getByText('Etichetta aggiornata.')).toBeVisible();
  await expect(list.getByText('Estero (UE)', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Elimina l’etichetta Estero (UE)' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('assegnata a 1 scheda');
  await expect(confirm).toContainText('Le schede non vengono eliminate');
  await confirm.getByRole('button', { name: 'Elimina etichetta' }).click();
  await expect(list.getByText('Estero (UE)', { exact: true })).toHaveCount(0);

  await openBoard(page);
  await expect(cardLink(page, 'Operatore sociosanitario')).toBeVisible(); // la scheda c'è ancora
});

test('10. da telefono (390 px) il configuratore è utilizzabile e senza scroll orizzontale', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openBoard(page);
  const dialog = await openConfigurator(page);
  await expect(dialog.getByRole('button', { name: 'Aggiungi campo' })).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  await dialog.getByRole('button', { name: 'Modifica “Turni”' }).click();
  const form = page.getByRole('dialog', { name: 'Modifica campo' });
  await expect(form.getByLabel('Opzione 1', { exact: true })).toBeVisible();
  await expectNoA11yViolations(page, 'configuratore a 390 px');
  expect(await smallTouchTargets(page, '[role=dialog]')).toEqual([]);
});
