import { expect, test, type Page } from '@playwright/test';
import {
  cardItem,
  cardLink,
  column,
  dragWithMouse,
  ensureWorkspace,
  expectNoA11yViolations,
  seedApi,
  smallTouchTargets,
} from './helpers';

// Smart Kanban (M5-SW.1) su stack reale: filtri nell'indirizzo, pannello, navigazione temporale,
// trascinamento tra colonne con i filtri attivi, mobile e accessibilità.
test.describe.configure({ mode: 'serial' });

let boardUrl: string;
const BOARD = 'Smart Kanban E2E';

/**
 * Titoli delle schede di una colonna. Legge il DOM direttamente: con il pannello dei filtri aperto
 * (modale) il resto della pagina è nascosto alle tecnologie assistive e i selettori per ruolo
 * non lo vedrebbero.
 */
const titlesIn = (page: Page, name: string) =>
  page
    .locator(`ul[aria-label="Schede in ${name}"] > li[data-card-id]`)
    .evaluateAll((items) => items.map((li) => li.querySelector('a')?.textContent ?? ''));

const filtersButton = (page: Page) => page.getByRole('button', { name: /^Filtri/ });
const panel = (page: Page) => page.getByRole('dialog', { name: 'Filtri' });
const bar = (page: Page) => page.getByTestId('smart-filter-bar');
const badge = (page: Page, name: string) => column(page, name).getByTestId('column-count');
const param = (page: Page, key: string) => new URL(page.url()).searchParams.get(key);

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await ensureWorkspace(page);
  const api = await seedApi(page);
  const existing = await api.findBoard(BOARD);
  const board = existing ? null : await api.board(BOARD);
  if (board) {
    const [todo, doing] = board.columns;
    const high = { priority: 'high' };
    // Da fare: Alfa (alta, Roma, remoto), Beta (nessuna priorità), Gamma (alta, Milano)
    await api.card(todo!.id, 'Alfa', {
      ...high,
      company: 'Acme',
      location: 'Roma',
      workMode: 'remote',
      appliedOn: '2020-03-10',
    });
    await api.card(todo!.id, 'Beta', { company: 'Beta Srl' });
    await api.card(todo!.id, 'Gamma', { ...high, company: 'Acme', location: 'Milano' });
    // In corso: Delta (alta)
    await api.card(doing!.id, 'Delta', { ...high, company: 'Delta SpA' });
    await page.goto(`/boards/${board.id}`);
  } else {
    await page.goto(`/boards/${existing}`);
  }
  await expect(page.getByRole('heading', { level: 1, name: BOARD })).toBeVisible();
  boardUrl = page.url().split('?')[0]!;
  await page.close();
});

test.beforeEach(async ({ page }) => {
  await page.goto(boardUrl);
  await expect(column(page, 'Da fare')).toBeVisible();
});

test('apre e chiude il pannello dei filtri (pulsante, Esc, Fatto) e riporta il focus', async ({
  page,
}) => {
  // Nessuna barra permanente senza filtri.
  await expect(bar(page)).toHaveCount(0);

  await filtersButton(page).click();
  await expect(panel(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel(page)).toBeHidden();
  await expect(filtersButton(page)).toBeFocused();

  await filtersButton(page).click();
  await panel(page).getByRole('button', { name: 'Fatto' }).click();
  await expect(panel(page)).toBeHidden();
  await expect(filtersButton(page)).toBeFocused();
});

test('applica un filtro: schede, contatori, contrassegno e indirizzo; persiste al refresh', async ({
  page,
}) => {
  await filtersButton(page).click();
  await panel(page).getByRole('group', { name: 'Priorità' }).getByLabel('Alta').check();
  await panel(page).getByRole('button', { name: 'Fatto' }).click();

  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Alfa', 'Gamma']);
  await expect.poll(() => titlesIn(page, 'In corso')).toEqual(['Delta']);
  await expect(page.getByTestId('smart-filter-count')).toHaveText('3 di 4 schede');
  await expect(badge(page, 'Da fare')).toHaveText('2/3');
  await expect(badge(page, 'Completate')).toHaveText('0/0');
  await expect(filtersButton(page)).toContainText('1');
  await expect(page.getByRole('list', { name: 'Filtri applicati' })).toContainText(
    'Priorità: Alta',
  );
  expect(param(page, 'priorita')).toBe('high');

  await page.reload();
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Alfa', 'Gamma']);
  await expect(page.getByTestId('smart-filter-count')).toHaveText('3 di 4 schede');

  // Rimuovi dal contrassegno → tutte le schede, indirizzo pulito.
  await page.getByRole('button', { name: 'Rimuovi filtro: Priorità: Alta' }).click();
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Alfa', 'Beta', 'Gamma']);
  await expect(bar(page)).toHaveCount(0);
  expect(new URL(page.url()).search).toBe('');
});

test('filtri combinati, località testuale e «Ripristina filtri»', async ({ page }) => {
  await page.goto(`${boardUrl}?priorita=high&azienda=Acme`);
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Alfa', 'Gamma']);
  await expect.poll(() => titlesIn(page, 'In corso')).toEqual([]);

  await filtersButton(page).click();
  await panel(page).getByLabel('Località').fill('milano');
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Gamma']);
  expect(param(page, 'localita')).toBe('milano');
  await panel(page).getByRole('button', { name: 'Ripristina filtri' }).click();
  await expect(panel(page).getByLabel('Località')).toHaveValue('');
  await panel(page).getByRole('button', { name: 'Fatto' }).click();
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Alfa', 'Beta', 'Gamma']);
  expect(new URL(page.url()).search).toBe('');
});

test('navigazione temporale: periodo precedente / successivo e stato vuoto', async ({ page }) => {
  // Le schede sono create «adesso»: oggi le include, ieri no.
  await page.goto(`${boardUrl}?creata=today`);
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Alfa', 'Beta', 'Gamma']);

  await page.getByRole('button', { name: 'Periodo precedente (Data di creazione)' }).click();
  expect(param(page, 'creata')).toBe('today-1');
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual([]);
  await expect(page.getByTestId('smart-filter-count')).toHaveText('0 di 4 schede');
  await expect(page.getByText('Nessuna candidatura corrisponde ai filtri attivi.')).toBeVisible();

  await page.getByRole('button', { name: 'Periodo successivo (Data di creazione)' }).click();
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Alfa', 'Beta', 'Gamma']);
  await expect(
    page.getByRole('button', { name: 'Periodo successivo (Data di creazione)' }),
  ).toBeDisabled();

  // Intervallo personalizzato sulla data di invio: solo Alfa (10/03/2020).
  await page.goto(`${boardUrl}?inviata=2020-01-01..2020-12-31`);
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Alfa']);
});

test('indirizzo non valido: tutte le schede e indirizzo ripulito', async ({ page }) => {
  await page.goto(`${boardUrl}?fase=inventata&creata=ieri&modalita=ufficio`);
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Alfa', 'Beta', 'Gamma']);
  await expect(bar(page)).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).search).toBe('');
  // Non in silenzio: un solo avviso informativo con i parametri scartati.
  await expect(
    page.getByRole('status').filter({ hasText: 'Alcuni filtri del link non erano validi' }),
  ).toHaveCount(1);
});

test('aprire una scheda e chiudere il pannello conserva i filtri', async ({ page }) => {
  await page.goto(`${boardUrl}?priorita=high`);
  await page.getByRole('link', { name: 'Alfa', exact: true }).click();
  await expect(page).toHaveURL(/\/cards\/[^?]+\?priorita=high/);
  await expect(page.getByRole('dialog', { name: /Alfa/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(new RegExp(`${boardUrl.split('/').pop()}\\?priorita=high$`));
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Alfa', 'Gamma']);
});

test('trascinamento con filtri: tra colonne sì, nella stessa colonna no; le nascoste non cambiano', async ({
  page,
}) => {
  await page.goto(`${boardUrl}?priorita=high`);
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Alfa', 'Gamma']);

  // Stessa colonna: Gamma sopra Alfa → nessun cambiamento (riordino disattivato).
  await dragWithMouse(page, cardItem(page, 'Gamma'), cardItem(page, 'Alfa'), { toPosition: 'top' });
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Alfa', 'Gamma']);

  // Tra colonne: Gamma in fondo a «In corso» (rilascio sotto l'ultima scheda).
  await dragWithMouse(
    page,
    cardItem(page, 'Gamma'),
    column(page, 'In corso').getByRole('button', { name: /Aggiungi scheda/ }),
  );
  await expect.poll(() => titlesIn(page, 'In corso')).toEqual(['Delta', 'Gamma']);
  await expect(badge(page, 'Da fare')).toHaveText('1/2');
  await expect(badge(page, 'In corso')).toHaveText('2/2');

  // Dopo il refresh e senza filtri: Beta (nascosta) è ancora dov'era, nell'ordine originale.
  await page.goto(boardUrl);
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Alfa', 'Beta']);
  await expect.poll(() => titlesIn(page, 'In corso')).toEqual(['Delta', 'Gamma']);

  // Ripristino della fixture per i test successivi.
  await dragWithMouse(
    page,
    cardItem(page, 'Gamma'),
    column(page, 'Da fare').getByRole('button', { name: /Aggiungi scheda/ }),
  );
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Alfa', 'Beta', 'Gamma']);
});

test('menu con filtri: «Sposta su/giù» disattivato, «Sposta in…» attivo', async ({ page }) => {
  await page.goto(`${boardUrl}?priorita=high`);
  await page.getByRole('button', { name: 'Azioni per la scheda “Alfa”' }).click();
  await expect(page.getByRole('menuitem', { name: 'Sposta su' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Sposta giù' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Completate' })).toBeEnabled();
  await page.keyboard.press('Escape');
});

test('tastiera: il pannello è raggiungibile e utilizzabile senza mouse', async ({ page }) => {
  await filtersButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(panel(page)).toBeVisible();
  const high = panel(page).getByRole('group', { name: 'Priorità' }).getByLabel('Alta');
  await high.focus();
  await page.keyboard.press('Space');
  await expect(high).toBeChecked();
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Alfa', 'Gamma']);
  await page.keyboard.press('Escape');
  await expect(filtersButton(page)).toBeFocused();
  await expect(filtersButton(page)).toContainText('1');
  // I contrassegni sono pulsanti raggiungibili con Tab.
  await page.getByRole('button', { name: 'Ripristina filtri' }).first().focus();
  await page.keyboard.press('Enter');
  await expect(bar(page)).toHaveCount(0);
});

test('accessibilità: pagina con filtri attivi e pannello aperto', async ({ page }) => {
  await page.goto(`${boardUrl}?priorita=high&creata=week`);
  await expect(bar(page)).toBeVisible();
  await expectNoA11yViolations(page, 'Kanban con filtri attivi');
  await filtersButton(page).click();
  await expect(panel(page)).toBeVisible();
  await expectNoA11yViolations(page, 'Pannello dei filtri');
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('pannello a schermo intero, nessuna barra senza filtri, nessun overflow, target ≥ 44 px', async ({
    page,
  }) => {
    await expect(bar(page)).toHaveCount(0);
    await expect(filtersButton(page)).toBeVisible();

    await filtersButton(page).click();
    await expect(panel(page)).toBeVisible();
    const box = (await panel(page).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(389); // schermo intero
    expect(await smallTouchTargets(page, '[role="dialog"]')).toEqual([]);

    await panel(page).getByRole('group', { name: 'Priorità' }).getByLabel('Alta').check();
    await panel(page).getByRole('button', { name: 'Fatto' }).click();
    await expect(panel(page)).toBeHidden();

    await expect(bar(page)).toBeVisible();
    expect(await smallTouchTargets(page, '[data-testid="smart-filter-bar"]')).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Alfa', 'Gamma']);
    await expectNoA11yViolations(page, 'Kanban filtrato (mobile)');
  });

  test('a 320 px i contrassegni scorrono in orizzontale senza allargare la pagina', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`${boardUrl}?priorita=high&azienda=Acme&creata=week&localita=Roma`);
    await expect(bar(page)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

// Avvisi dei filtri (SW.1, C1 e C2). Bacheca propria: le schede create qui non alterano i conteggi
// degli altri test; ogni scheda ha un titolo unico, quindi i test restano ripetibili.
test.describe('avvisi dei filtri', () => {
  const NOTICE_BOARD = 'Smart Kanban Avvisi E2E';
  let noticeBoardUrl: string;
  let counter = 0;
  const unique = (prefix: string) => `${prefix} ${Date.now()}-${++counter}`;

  const hiddenNotice = (page: Page) =>
    page.getByRole('status').filter({ hasText: 'non è visibile con i filtri attivi' });
  const invalidNotice = (page: Page) =>
    page.getByRole('status').filter({ hasText: 'Alcuni filtri del link non erano validi' });

  /** Aggiunge una scheda dalla colonna senza attendere che compaia (con i filtri può restare nascosta). */
  async function addInColumn(page: Page, columnName: string, title: string) {
    const col = column(page, columnName);
    await col.getByRole('button', { name: /Aggiungi scheda/ }).click();
    const input = col.getByLabel(`Titolo della nuova scheda in ${columnName}`);
    await input.fill(title);
    await input.press('Enter');
  }

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureWorkspace(page);
    const api = await seedApi(page);
    let id = await api.findBoard(NOTICE_BOARD);
    if (!id) {
      const created = await api.board(NOTICE_BOARD);
      id = created.id;
      await api.card(created.columns[0]!.id, 'Riferimento', { stage: 'applied', priority: 'high' });
      await api.card(created.columns[0]!.id, 'Senza priorità', { stage: 'saved' });
    }
    await page.goto(`/boards/${id}`);
    await expect(page.getByRole('heading', { level: 1, name: NOTICE_BOARD })).toBeVisible();
    noticeBoardUrl = page.url().split('?')[0]!;
    await page.close();
  });

  test('C1: la scheda creata e nascosta dal filtro è salvata, segnalata e si mostra con «Ripristina filtri»', async ({
    page,
  }) => {
    await page.goto(`${noticeBoardUrl}?fase=applied`);
    await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Riferimento']);
    const title = unique('Nascosta');

    await addInColumn(page, 'Da fare', title);
    const notice = hiddenNotice(page);
    await expect(notice).toHaveCount(1);
    await expect(notice).toContainText(`Scheda “${title}” creata, ma non è visibile`);
    // Informativo: non è un errore, quindi non è un avviso assertivo.
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(cardLink(page, title)).toHaveCount(0);
    await expect(page.getByTestId('smart-filter-count')).toHaveText(/^1 di \d+ schede$/);
    await expectNoA11yViolations(page, 'Avviso «creata ma nascosta»');

    await notice.getByRole('button', { name: 'Ripristina filtri' }).click();
    await expect(cardLink(page, title)).toBeVisible();
    await expect(cardLink(page, title)).toHaveCount(1); // né duplicata né sostituita
    expect(new URL(page.url()).search).toBe('');
    await expect(bar(page)).toHaveCount(0);
    await expect(notice).toHaveCount(0);

    // Salvata davvero: sopravvive al ricaricamento, una sola volta.
    await page.reload();
    await expect(cardLink(page, title)).toHaveCount(1);
  });

  test('C1: la scheda che soddisfa i filtri compare e non genera avvisi', async ({ page }) => {
    await page.goto(`${noticeBoardUrl}?creata=today`);
    await expect(column(page, 'Da fare')).toBeVisible();
    const title = unique('Visibile');
    await addInColumn(page, 'Da fare', title);
    await expect(cardLink(page, title)).toBeVisible();
    await expect(hiddenNotice(page)).toHaveCount(0);
  });

  test('C1: senza filtri attivi nessun avviso', async ({ page }) => {
    await page.goto(noticeBoardUrl);
    const title = unique('Libera');
    await addInColumn(page, 'Da fare', title);
    await expect(cardLink(page, title)).toBeVisible();
    await expect(hiddenNotice(page)).toHaveCount(0);
  });

  test('C1: creazione globale («Nuova scheda» dall’intestazione) in una bacheca filtrata', async ({
    page,
  }) => {
    await page.goto(`${noticeBoardUrl}?fase=applied`);
    await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Riferimento']);
    const title = unique('Globale');

    await page.getByRole('button', { name: 'Azioni della vista' }).click();
    await page.getByRole('menuitem', { name: 'Nuova opportunità' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuova opportunità' });
    await dialog.getByLabel('Titolo').fill(title);
    await dialog.getByLabel('Titolo').press('Enter');

    const notice = hiddenNotice(page);
    await expect(notice).toContainText(`Scheda “${title}” creata, ma non è visibile`);
    await expect(page.getByText(`Opportunità “${title}” creata.`, { exact: true })).toBeVisible();
    await expect(cardLink(page, title)).toHaveCount(0);

    await notice.getByRole('button', { name: 'Ripristina filtri' }).click();
    await expect(cardLink(page, title)).toBeVisible();
    expect(new URL(page.url()).search).toBe('');
  });

  test('C2: ?fase=xyz&priorita=high scarta solo il non valido, riscrive l’indirizzo e avvisa una volta', async ({
    page,
  }) => {
    await page.goto(noticeBoardUrl);
    await expect(column(page, 'Da fare')).toBeVisible();

    await page.goto(`${noticeBoardUrl}?fase=xyz&priorita=high`);
    const notice = invalidNotice(page);
    await expect(notice).toHaveCount(1);
    await expect(notice).toContainText('Fase: “xyz” non valido');
    await expect.poll(() => new URL(page.url()).search).toBe('?priorita=high');

    // Il filtro valido resta attivo.
    await expect(page.getByRole('list', { name: 'Filtri applicati' })).toContainText(
      'Priorità: Alta',
    );
    await expect(page.getByRole('list', { name: 'Filtri applicati' })).not.toContainText('Fase');
    await expect.poll(() => titlesIn(page, 'Da fare')).toContain('Riferimento');
    await expect.poll(() => titlesIn(page, 'Da fare')).not.toContain('Senza priorità');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expectNoA11yViolations(page, 'Avviso «filtri del link non validi»');

    // Altri rendering non ripetono l'avviso.
    await filtersButton(page).click();
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(notice).toHaveCount(1);

    // Nessuna nuova voce di cronologia: «indietro» torna alla pagina precedente, non al link non valido.
    await page.goBack();
    expect(page.url()).toBe(noticeBoardUrl);
    await expect(invalidNotice(page)).toHaveCount(0);
  });

  test('C2: variazioni solo cosmetiche e indirizzi canonici non producono avvisi', async ({
    page,
  }) => {
    await page.goto(`${noticeBoardUrl}?priorita=high,high&creata=week-0`);
    await expect.poll(() => new URL(page.url()).search).toBe('?creata=week&priorita=high');
    await expect(invalidNotice(page)).toHaveCount(0);

    await page.goto(`${noticeBoardUrl}?fase=applied&priorita=high`);
    await expect(bar(page)).toBeVisible();
    await expect(invalidNotice(page)).toHaveCount(0);
    expect(new URL(page.url()).search).toBe('?fase=applied&priorita=high');
  });

  test.describe('mobile', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('C1: l’avviso entra nello schermo, ha un bersaglio di 44 px e passa i controlli axe', async ({
      page,
    }) => {
      await page.goto(`${noticeBoardUrl}?fase=applied`);
      await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Riferimento']);
      const title = unique('Mobile');
      await addInColumn(page, 'Da fare', title);

      const notice = hiddenNotice(page);
      await expect(notice).toHaveCount(1);
      const box = (await notice.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(box.y + box.height).toBeLessThanOrEqual(844);
      expect(await smallTouchTargets(page, '[role="status"]')).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await expectNoA11yViolations(page, 'Avviso «creata ma nascosta» (mobile)');

      await notice.getByRole('button', { name: 'Ripristina filtri' }).tap();
      await expect(cardLink(page, title)).toBeVisible();
    });

    test('C2: l’avviso dei filtri non validi entra nello schermo', async ({ page }) => {
      await page.goto(`${noticeBoardUrl}?fase=xyz&priorita=high`);
      const notice = invalidNotice(page);
      await expect(notice).toHaveCount(1);
      const box = (await notice.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(await smallTouchTargets(page, '[role="status"]')).toEqual([]);
      await expectNoA11yViolations(page, 'Avviso «filtri del link non validi» (mobile)');
    });
  });
});
