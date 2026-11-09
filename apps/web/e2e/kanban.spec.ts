import { expect, test, type Page } from '@playwright/test';
import {
  cardItem,
  cardLink,
  openTab,
  column,
  createBoard,
  dragWithMouse,
  ensureWorkspace,
  expectNoA11yViolations,
  quickAdd,
  titlesIn,
} from './helpers';

// Interazioni del Kanban (M1.3) su stack reale: trascinamento, tastiera, touch, rollback, responsive.
test.describe.configure({ mode: 'serial' });

const colTitles = (page: Page) => page.locator('[data-column-id] h3').allTextContents();
let boardUrl: string;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await ensureWorkspace(page);
  await createBoard(page, 'Kanban DnD', 'Minimal');
  for (const t of ['Alfa', 'Beta', 'Gamma']) await quickAdd(page, 'Da fare', t);
  await quickAdd(page, 'In corso', 'Delta');
  boardUrl = page.url();
  await page.close();
});

test.beforeEach(async ({ page }) => {
  // Retry seriale: beforeAll crea una nuova fixture. Usare il suo ID, non il nome duplicabile.
  await page.goto(boardUrl);
  await expect(column(page, 'Da fare')).toBeVisible();
});

test('mouse: riordina nella stessa colonna e il nuovo ordine persiste dopo il refresh', async ({
  page,
}) => {
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Alfa', 'Beta', 'Gamma']);
  // Gamma sopra Alfa (rilascio sulla metà superiore del primo elemento).
  await dragWithMouse(page, cardItem(page, 'Gamma'), cardItem(page, 'Alfa'), { toPosition: 'top' });
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Gamma', 'Alfa', 'Beta']);

  await page.reload();
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Gamma', 'Alfa', 'Beta']);
});

test('mouse: sposta tra colonne (in mezzo, in colonna vuota) e persiste', async ({ page }) => {
  // Prima di tutto: In corso contiene Delta. Beta tra... in coda a In corso.
  // Rilascio nella parte bassa della colonna, sotto l'ultima scheda: la scheda va in fondo.
  await dragWithMouse(
    page,
    cardItem(page, 'Beta'),
    column(page, 'In corso').getByRole('button', { name: /Aggiungi scheda/ }),
  );
  await expect.poll(() => titlesIn(page, 'In corso')).toEqual(['Delta', 'Beta']);
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Gamma', 'Alfa']);

  // Verso la colonna vuota "Completate", rilasciando sulla colonna stessa.
  await dragWithMouse(page, cardItem(page, 'Alfa'), column(page, 'Completate'));
  await expect.poll(() => titlesIn(page, 'Completate')).toEqual(['Alfa']);

  // In mezzo a due schede: Gamma tra Delta e Beta.
  await dragWithMouse(page, cardItem(page, 'Gamma'), cardItem(page, 'Beta'), { toPosition: 'top' });
  await expect.poll(() => titlesIn(page, 'In corso')).toEqual(['Delta', 'Gamma', 'Beta']);

  await page.reload();
  await expect.poll(() => titlesIn(page, 'In corso')).toEqual(['Delta', 'Gamma', 'Beta']);
  await expect.poll(() => titlesIn(page, 'Completate')).toEqual(['Alfa']);
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual([]);

  // Lo spostamento tra colonne è registrato nella cronologia.
  await cardLink(page, 'Alfa').click();
  const panel = page.getByRole('dialog', { name: 'Alfa' });
  await openTab(panel, 'Timeline');
  await expect(panel.getByText('Scheda spostata')).toBeVisible();
});

test('mouse: riordina le colonne trascinando la maniglia; persiste', async ({ page }) => {
  expect(await colTitles(page)).toEqual(['Da fare', 'In corso', 'Completate']);
  const handle = page.getByRole('button', { name: 'Sposta la colonna “Completate”' });
  await dragWithMouse(
    page,
    handle,
    page.getByRole('button', { name: 'Sposta la colonna “Da fare”' }),
  );
  await expect.poll(() => colTitles(page)).toEqual(['Completate', 'Da fare', 'In corso']);
  await page.reload();
  await expect.poll(() => colTitles(page)).toEqual(['Completate', 'Da fare', 'In corso']);
  // Ripristina l'ordine per i test successivi.
  const again = page.getByRole('button', { name: 'Sposta la colonna “Completate”' });
  await dragWithMouse(
    page,
    again,
    page.getByRole('button', { name: 'Sposta la colonna “In corso”' }),
  );
  await expect.poll(() => colTitles(page)).toEqual(['Da fare', 'In corso', 'Completate']);
});

test('tastiera: la maniglia solleva la scheda, le frecce la spostano, Spazio rilascia', async ({
  page,
}) => {
  await expect.poll(() => titlesIn(page, 'In corso')).toEqual(['Delta', 'Gamma', 'Beta']);
  const handle = page.getByRole('button', { name: 'Sposta la scheda “Beta” con la tastiera' });
  await handle.focus();
  await page.keyboard.press('Space');
  // Annuncio per screen reader (live region di dnd-kit).
  await expect(page.getByText(/Hai preso “Beta”/)).toBeAttached();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByText(/“Beta” è ora sopra “Gamma” in “In corso”/)).toBeAttached();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  await expect(page.getByText(/“Beta” rilasciata in “In corso”/)).toBeAttached();
  await expect.poll(() => titlesIn(page, 'In corso')).toEqual(['Beta', 'Delta', 'Gamma']);

  await page.reload();
  await expect.poll(() => titlesIn(page, 'In corso')).toEqual(['Beta', 'Delta', 'Gamma']);
});

test('tastiera: Esc annulla il trascinamento senza modifiche', async ({ page }) => {
  const before = await titlesIn(page, 'In corso');
  const handle = page.getByRole('button', { name: 'Sposta la scheda “Beta” con la tastiera' });
  await handle.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect.poll(() => titlesIn(page, 'In corso')).toEqual(before);
  await page.reload();
  await expect.poll(() => titlesIn(page, 'In corso')).toEqual(before);
});

test('tastiera: il titolo è un link (Invio apre il dettaglio), non innesca il trascinamento', async ({
  page,
}) => {
  await cardLink(page, 'Delta').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Delta' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(cardLink(page, 'Delta')).toBeFocused();
});

test('11. errore di persistenza: la scheda torna dov’era (rollback) con un avviso; poi riprova e riesce', async ({
  page,
}) => {
  const before = await titlesIn(page, 'In corso');
  await page.route('**/api/v1/cards/*/move*', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'internal_error', message: 'x', requestId: 'r' } }),
    }),
  );
  await dragWithMouse(page, cardItem(page, 'Delta'), column(page, 'Completate'));

  await expect(
    page.getByRole('alert').filter({ hasText: 'tornata nella posizione originale' }),
  ).toBeVisible();
  await expect.poll(() => titlesIn(page, 'In corso')).toEqual(before);
  await expect.poll(() => titlesIn(page, 'Completate')).toEqual(['Alfa']);
  await page.reload();
  await expect.poll(() => titlesIn(page, 'In corso')).toEqual(before);

  await page.unroute('**/api/v1/cards/*/move*');
  await dragWithMouse(
    page,
    cardItem(page, 'Delta'),
    column(page, 'Completate').getByRole('button', { name: /Aggiungi scheda/ }),
  );
  await expect.poll(() => titlesIn(page, 'Completate')).toEqual(['Alfa', 'Delta']);
});

test('lo stato di caricamento: durante un salvataggio lento la scheda è già nella nuova posizione', async ({
  page,
}) => {
  const slow = '**/api/v1/cards/*/move*';
  await page.route(slow, async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue().catch(() => {}); // la pagina può essere già cambiata
  });
  const saved = page.waitForResponse((r) => /\/cards\/[^/]+\/move/.test(r.url()));
  await page.getByRole('button', { name: 'Azioni per la scheda “Delta”' }).click();
  await page.getByRole('menuitem', { name: 'Da fare' }).click();
  // Aggiornamento ottimistico: visibile subito, prima della risposta del server.
  await expect.poll(() => titlesIn(page, 'Da fare'), { timeout: 900 }).toContain('Delta');
  await saved;
  await page.unroute(slow);
  await page.reload();
  await expect.poll(() => titlesIn(page, 'Da fare')).toContain('Delta');
});

test('menu alternativo al trascinamento: su/giù e "Sposta in" da tastiera', async ({ page }) => {
  await page.reload();
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Delta']);
  await quickAdd(page, 'Da fare', 'Epsilon');
  const trigger = page.getByRole('button', { name: 'Azioni per la scheda “Epsilon”' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Sposta su' }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Epsilon', 'Delta']);
});

test.describe('responsive', () => {
  for (const width of [390, 768, 1024, 1360]) {
    test(`${width}px: nessuno scroll orizzontale della pagina, Kanban scorrevole, controlli raggiungibili`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.reload();
      await expect(column(page, 'Da fare')).toBeVisible();

      // La pagina non scorre in orizzontale: scorre solo la bacheca.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      const kanban = page.getByTestId('kanban');
      const scrolls = await kanban.evaluate((el) => el.scrollWidth > el.clientWidth);
      // Dopo la rimozione della colonna aggiuntiva le tre colonne possono entrare sul laptop.
      expect(scrolls).toBe(width < 1360);
      await page.getByRole('button', { name: 'Azioni della vista' }).click();
      await expect(page.getByRole('menuitem', { name: 'Aggiungi colonna' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expectNoA11yViolations(page, `bacheca ${width}px`);
    });
  }

  test('390px: pulsanti, maniglie e campi della bacheca hanno un’area touch di almeno 44px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.reload();
    await expect(column(page, 'Da fare')).toBeVisible();
    const small = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll('main button, main select, main input')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue; // non visualizzati
        if (Math.min(r.width, r.height) < 43.5) {
          out.push(
            `${el.tagName} "${el.getAttribute('aria-label') ?? el.textContent?.trim()}" ${Math.round(r.width)}x${Math.round(r.height)}`,
          );
        }
      }
      return out;
    });
    expect(small).toEqual([]);
  });

  test('390px: il pannello di dettaglio occupa lo schermo intero e si può chiudere', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.reload();
    await cardLink(page, 'Epsilon').click();
    const panel = page.getByRole('dialog', { name: 'Epsilon' });
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(388);
    expect(box.height).toBeGreaterThanOrEqual(790);
    await expectNoA11yViolations(page, 'dettaglio mobile');
    await panel.getByRole('button', { name: 'Chiudi' }).click();
    await expect(panel).toBeHidden();
  });

  test('1024px e 1360px: la modale è centrata, larga al massimo 1000 px e alta al massimo 90% dello schermo', async ({
    page,
  }) => {
    for (const width of [1024, 1360]) {
      await page.setViewportSize({ width, height: 800 });
      await page.reload();
      await cardLink(page, 'Epsilon').click();
      const panel = page.getByRole('dialog', { name: 'Epsilon' });
      await expect(panel).toBeVisible();
      const box = (await panel.boundingBox())!;
      expect(box.width).toBeLessThanOrEqual(1000.5);
      expect(box.height).toBeLessThanOrEqual(720.5); // 90dvh di 800
      expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(2); // centrata
      expect(Math.abs(box.y + box.height / 2 - 400)).toBeLessThan(2);
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
    }
  });
});

test.describe('touch (telefono)', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('pressione prolungata e trascinamento spostano la scheda; un tocco breve apre il dettaglio', async ({
    page,
  }) => {
    const before = await titlesIn(page, 'Da fare');
    expect(before).toContain('Epsilon');

    // Tocco breve = apertura del dettaglio (non un trascinamento).
    await cardLink(page, 'Epsilon').tap();
    await expect(page.getByRole('dialog', { name: 'Epsilon' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Chiudi' }).click();

    // Pressione prolungata + movimento verso la colonna "In corso" (via CDP: eventi touch reali).
    const cdp = await page.context().newCDPSession(page);
    const card = (await cardLink(page, 'Epsilon').boundingBox())!;
    const startX = card.x + card.width / 2;
    const startY = card.y + card.height / 2;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY }],
    });
    await page.waitForTimeout(350);
    // Scorre orizzontalmente fino a portare "In corso" sotto il dito.
    const target = column(page, 'In corso');
    await target.scrollIntoViewIfNeeded();
    const t = (await target.boundingBox())!;
    for (let i = 1; i <= 12; i++) {
      const x = startX + ((t.x + t.width / 2 - startX) * i) / 12;
      const y = startY + ((t.y + 120 - startY) * i) / 12;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
      await page.waitForTimeout(30);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => titlesIn(page, 'In corso')).toContain('Epsilon');
    await page.reload();
    await expect(column(page, 'In corso')).toBeVisible();
    await expect.poll(() => titlesIn(page, 'In corso')).toContain('Epsilon');
  });

  test('senza trascinamento: tutto il flusso (crea, sposta da menu, archivia) è eseguibile con il tocco', async ({
    page,
  }) => {
    await quickAdd(page, 'Completate', 'Zeta');
    await page.getByRole('button', { name: 'Azioni per la scheda “Zeta”' }).tap();
    await page.getByRole('menuitem', { name: 'In corso' }).tap();
    await expect.poll(() => titlesIn(page, 'In corso')).toContain('Zeta');
    await page.getByRole('button', { name: 'Azioni per la scheda “Zeta”' }).tap();
    await page.getByRole('menuitem', { name: 'Archivia' }).tap();
    await expect(cardLink(page, 'Zeta')).toHaveCount(0);
  });
});
