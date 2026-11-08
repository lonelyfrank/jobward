import { expect, test } from '@playwright/test';
import { ensureWorkspace, seedApi, smallTouchTargets, waitForAnimationsToSettle } from './helpers';

let boardId: string;
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await ensureWorkspace(page);
  const api = await seedApi(page);
  // Le fixture sono immutabili: un riavvio del worker dopo una failure le riusa.
  const existing = await api.findBoard('Responsive stabilizzazione M3');
  if (existing) {
    boardId = existing;
    await page.close();
    return;
  }
  const board = await api.board('Responsive stabilizzazione M3');
  boardId = board.id;
  await api.card(board.columns[0]!.id, 'Candidatura responsive M3');
  await page.close();
});

test('il misuratore touch distingue link estesi, link piccoli e pseudo-elementi non interattivi', async ({
  page,
}) => {
  await page.setContent(`<style>
    .card { position: relative; width: 200px; height: 90px; }
    a { display: block; width: 32px; height: 24px; }
    .stretched::after { content: ''; position: absolute; inset: 0; }
    .disabled::after { pointer-events: none; }
  </style><div class="card"><a href="#" class="stretched">Esteso</a></div><a href="#">Piccolo</a>`);
  expect(await smallTouchTargets(page, 'body')).toEqual(['A "Piccolo" 32x24']);
  await page.locator('.stretched').evaluate((el) => el.classList.add('disabled'));
  expect(await smallTouchTargets(page, 'body')).toEqual(['A "Esteso" 32x24', 'A "Piccolo" 32x24']);
});

test('la card bacheca è cliccabile fuori dal testo e mantiene le azioni separate', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/boards');
  const link = page
    .getByRole('main')
    .getByRole('link', { name: 'Responsive stabilizzazione M3', exact: true });
  await link.scrollIntoViewIfNeeded();
  const target = await link.evaluate((el) => {
    const box = (el as HTMLElement).offsetParent!.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    return {
      x,
      y,
      width: box.width,
      height: box.height,
      hitsLink: document.elementFromPoint(x, y) === el,
    };
  });
  expect(target.hitsLink).toBe(true);
  expect(Math.min(target.width, target.height)).toBeGreaterThanOrEqual(44);
  await page.mouse.click(target.x, target.y);
  await expect(page).toHaveURL(`/boards/${boardId}`);
  await page.goto('/boards');
  await page.getByRole('button', { name: 'Azioni per “Responsive stabilizzazione M3”' }).click();
  await expect(page.getByRole('menuitem', { name: 'Modifica…', exact: true })).toBeVisible();
  await expect(page).toHaveURL('/boards');
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
    test(`${theme} ${width}px: viste workspace senza overflow`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 960 });
      await page.addInitScript((value) => localStorage.setItem('jobward-theme', value), theme);
      await page.emulateMedia({ reducedMotion: width === 375 ? 'reduce' : 'no-preference' });
      const paths = {
        overview: '/',
        boards: '/boards',
        kanban: `/boards/${boardId}`,
        table: `/boards/${boardId}/table`,
        opportunities: '/opportunities?q=responsive+M3',
        tasks: '/tasks',
      };
      for (const [view, path] of Object.entries(paths)) {
        await page.goto(path);
        if (view === 'overview') await expect(page.getByTestId('stat-grid')).toBeVisible();
        if (view === 'boards')
          await expect(
            page
              .getByRole('main')
              .getByRole('link', { name: 'Responsive stabilizzazione M3', exact: true }),
          ).toBeVisible();
        if (['kanban', 'table', 'opportunities'].includes(view))
          await expect(
            page.getByRole('link', { name: 'Candidatura responsive M3', exact: true }),
          ).toBeVisible();
        if (view === 'tasks')
          await expect(
            page.getByRole('button', { name: 'Nuova attività', exact: true }).first(),
          ).toBeVisible();
        if (view === 'tasks')
          await expect(page.locator('main [aria-busy]')).toHaveAttribute('aria-busy', 'false');
        await waitForAnimationsToSettle(page);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
          `${view} ${width}px`,
        ).toBe(0);
        if (width < 768)
          expect(await smallTouchTargets(page, '[data-testid="workspace-page-header"]')).toEqual(
            [],
          );
        if ((width === 390 || width === 1440) && ['kanban', 'table'].includes(view)) {
          await page.screenshot({ path: info.outputPath(`${view}-${theme}-${width}.png`) });
        }
      }
    });
  }
}
