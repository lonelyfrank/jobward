import { expect, test, type Page } from '@playwright/test';
import { column, ensureWorkspace, seedApi, waitForAnimationsToSettle } from './helpers';

/**
 * Glass Subtle è una finitura ESCLUSIVA del contenitore esterno delle colonne Kanban.
 * Verifica sullo stile calcolato reale: colonne = vetro; schede e ogni altra vista = originale.
 * I comportamenti (drag-and-drop, creazione, menu…) sono coperti da kanban.spec.ts e boards.spec.ts.
 */
test.describe.configure({ mode: 'serial' });

const BOARD = 'Vetro Kanban';
let boardId = '';

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await ensureWorkspace(page);
  const api = await seedApi(page);
  const board = await api.board(BOARD);
  boardId = board.id;
  await api.card(board.columns[0]!.id, 'Scheda vetro A', { company: 'Acme' });
  await api.card(board.columns[1]!.id, 'Scheda vetro B', { company: 'Nimbus' });
  await page.close();
});

async function open(page: Page, path: string, ready: string, theme: 'light' | 'dark') {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('jobward-theme', t), theme);
  await page.goto(path);
  await page.getByText(ready).locator('visible=true').first().waitFor();
  await waitForAnimationsToSettle(page);
}

/** Elementi della pagina con materiale Glass o con un backdrop-filter qualunque. */
const glassAudit = (page: Page) =>
  page.evaluate(() => ({
    glassHosts: document.querySelectorAll('.glass-subtle').length,
    backdropElements: [...document.querySelectorAll<HTMLElement>('body *')].filter(
      (el) =>
        getComputedStyle(el).backdropFilter !== 'none' ||
        getComputedStyle(el, '::before').backdropFilter !== 'none' ||
        getComputedStyle(el, '::after').backdropFilter !== 'none',
    ).length,
  }));

for (const theme of ['dark', 'light'] as const) {
  test.describe(`tema ${theme}`, () => {
    test('Kanban: ogni colonna è vetro, sostituisce lo sfondo e non filtra il contenuto', async ({
      page,
    }) => {
      await open(page, `/boards/${boardId}`, 'Scheda vetro A', theme);
      const hosts = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[data-column-id]')].map((col) => {
          const cs = getComputedStyle(col);
          const before = getComputedStyle(col, '::before');
          const after = getComputedStyle(col, '::after');
          return {
            isGlass: col.classList.contains('glass-subtle'),
            bg: cs.backgroundColor,
            filter: cs.filter,
            backdrop: cs.backdropFilter,
            transform: cs.transform,
            opacity: cs.opacity,
            position: cs.position,
            overflow: cs.overflow,
            beforeBackdrop: before.backdropFilter,
            beforeZ: before.zIndex,
            beforePointer: before.pointerEvents,
            afterPointer: after.pointerEvents,
            width: Math.round(col.getBoundingClientRect().width),
            filteredDescendants: [...col.querySelectorAll<HTMLElement>('*')].filter(
              (el) => getComputedStyle(el).backdropFilter !== 'none',
            ).length,
          };
        }),
      );
      expect(hosts.length).toBeGreaterThan(1);
      for (const h of hosts) {
        expect(h.isGlass).toBe(true);
        // Nessun sfondo opaco sull'host (il vecchio bg-surface-muted è stato sostituito).
        expect(h.bg).toBe('rgba(0, 0, 0, 0)');
        expect(h.beforeBackdrop).toMatch(/blur\(12px\)/);
        expect(h.beforeZ).toBe('-1');
        expect(h.beforePointer).toBe('none');
        expect(h.afterPointer).toBe('none');
        // L'host non è filtrato, né trasformato (a riposo), né ha overflow alterato.
        expect(h.filter).toBe('none');
        expect(h.backdrop).toBe('none');
        expect(h.transform).toBe('none');
        expect(h.opacity).toBe('1');
        expect(h.position).toBe('relative');
        expect(h.overflow).toBe('visible');
        expect(h.width).toBe(288);
        expect(h.filteredDescendants).toBe(0);
      }
    });

    test('Kanban: le schede interne restano opache e non sono vetro', async ({ page }) => {
      await open(page, `/boards/${boardId}`, 'Scheda vetro A', theme);
      const info = await page
        .locator('[data-card-id]')
        .first()
        .evaluate((el) => ({
          isGlass: el.classList.contains('glass-subtle'),
          glassAncestors: [...document.querySelectorAll('.glass-subtle')].filter((g) =>
            g.contains(el),
          ).length,
          backdrop: getComputedStyle(el).backdropFilter,
          bodyBg: getComputedStyle(el.querySelector('div') ?? el).backgroundColor,
        }));
      expect(info.isGlass).toBe(false);
      expect(info.glassAncestors).toBe(1); // solo la colonna che la contiene
      expect(info.backdrop).toBe('none');
      expect(info.bodyBg).not.toMatch(/rgba\(.*,\s*0(\.\d+)?\)$/);
    });

    const OTHER_VIEWS = [
      { name: 'Overview', path: () => '/', ready: 'Opportunità recenti' },
      { name: 'elenco Bacheche', path: () => '/boards', ready: BOARD },
      { name: 'Opportunità', path: () => '/opportunities', ready: 'Scheda vetro A' },
      { name: 'Attività', path: () => '/tasks', ready: 'Nessuna attività, per ora' },
      { name: 'Insights', path: () => '/insights', ready: 'Le statistiche nascono dai tuoi dati' },
      {
        name: 'bacheca in modalità Tabella',
        path: () => `/boards/${boardId}/table`,
        ready: 'Scheda vetro A',
      },
    ];
    for (const view of OTHER_VIEWS) {
      test(`${view.name}: nessun materiale Glass né backdrop-filter`, async ({ page }) => {
        await open(page, view.path(), view.ready, theme);
        expect(await glassAudit(page)).toEqual({ glassHosts: 0, backdropElements: 0 });
      });
    }
  });
}

test('Kanban: con forced-colors il vetro lascia il posto a una superficie di sistema', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await open(page, `/boards/${boardId}`, 'Scheda vetro A', 'dark');
  const first = await page
    .locator('[data-column-id]')
    .first()
    .evaluate((el) => ({
      before: getComputedStyle(el, '::before').display,
      after: getComputedStyle(el, '::after').display,
    }));
  expect(first).toEqual({ before: 'none', after: 'none' });
});

test('Kanban: con contrasto elevato la colonna diventa opaca, senza blur', async ({ page }) => {
  await page.emulateMedia({ contrast: 'more' });
  await open(page, `/boards/${boardId}`, 'Scheda vetro A', 'dark');
  const before = await page
    .locator('[data-column-id]')
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el, '::before');
      return { backdrop: s.backdropFilter, bg: s.backgroundColor };
    });
  expect(before.backdrop).toBe('none');
  expect(before.bg).not.toMatch(/rgba\(.*,\s*0(\.\d+)?\)$/);
});

test('Kanban: il menu della colonna resta sopra il vetro e utilizzabile', async ({ page }) => {
  await open(page, `/boards/${boardId}`, 'Scheda vetro A', 'dark');
  await column(page, 'Da fare')
    .getByRole('button', { name: /Azioni per la colonna/ })
    .click();
  const item = page.getByRole('menuitem', { name: 'Modifica…' });
  await expect(item).toBeVisible();
  const onTop = await item.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!hit && el.contains(hit);
  });
  expect(onTop).toBe(true);
});
