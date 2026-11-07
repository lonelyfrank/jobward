import { expect, test, type Page } from '@playwright/test';
import { COLOR_TOKENS } from '@jobward/schemas';
import { COLOR_LABELS } from '../src/lib/labels';
import { board, boardDetail, column } from '../src/test/fixtures';
import { expectNoA11yViolations, waitForAnimationsToSettle } from './helpers';

async function openBackground(page: Page) {
  await page.getByRole('button', { name: 'Azioni della vista' }).click();
  await page
    .getByRole('menuitem', { name: 'Cambia il background di Ricerca autunno', exact: true })
    .click();
}

test.beforeEach(async ({ page }) => {
  const detail = boardDetail();
  detail.columns.push(
    ...Array.from({ length: 5 }, (_, index) =>
      column(`extra-${index}`, `Colonna ${index + 4}`, (index + 4) * 1024),
    ),
  );
  const other = {
    ...detail,
    board: { ...detail.board, id: 'b2', name: 'Altra ricerca', color: 'rose' },
  };
  await page.addInitScript(() => localStorage.setItem('jobward-sidebar-collapsed', '1'));
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'PATCH' && path.endsWith('/boards/b1')) {
      detail.board = {
        ...detail.board,
        ...(route.request().postDataJSON() as { color: string | null }),
      };
      await route.fulfill({ json: { board: detail.board } });
      return;
    }
    const json = path.endsWith('/me')
      ? {
          user: { id: 'u1', email: 'board@example.com' },
          workspaces: [
            { id: 'w1', name: 'Ricerca', timezone: 'Europe/Rome', role: 'owner', createdAt: 1 },
          ],
        }
      : path.endsWith('/boards/b1')
        ? detail
        : path.endsWith('/boards/b2')
          ? other
          : path.endsWith('/boards')
            ? { boards: [board({ color: detail.board.color }), board({ id: 'b2', color: 'rose' })] }
            : path.endsWith('/overview')
              ? {
                  workspaceId: 'w1',
                  counts: {
                    boards: 2,
                    opportunities: 2,
                    applicationsSubmitted: 0,
                    interviews: 0,
                    openTasks: 0,
                    overdueTasks: 0,
                    dueTodayTasks: 0,
                    noDueTasks: 0,
                  },
                  upcomingTasks: [],
                  recentBoards: [],
                  recentCards: [],
                }
              : path.endsWith('/opportunities')
                ? { items: [], total: 0, page: 1, pageSize: 50, pageCount: 0 }
                : path.endsWith('/custom-fields')
                  ? { fields: [] }
                  : { labels: [] };
    await route.fulfill({ json });
  });
});

for (const theme of ['light', 'dark'] as const) {
  test(`sfondo per bacheca: salvataggio, ricaricamento, cambio vista e accessibilità (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((value) => localStorage.setItem('jobward-theme', value), theme);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto('/boards/b1');
    const surface = page.getByTestId('board-surface');
    const sidebar = page.locator('aside');
    await expect(surface).toHaveAttribute('data-board-color', 'blue');
    await expect(sidebar).toHaveCSS('box-shadow', 'none');
    const background = await page
      .locator('body')
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    await openBackground(page);
    const dialog = page.getByRole('dialog', { name: 'Cambia background' });
    await expectNoA11yViolations(page, `selettore background ${theme}`);
    await dialog.getByRole('radio', { name: 'Verde' }).check();
    await dialog.getByRole('button', { name: 'Salva sfondo' }).click();
    await expect(dialog).toBeHidden();
    await expect(surface).toHaveAttribute('data-board-color', 'green');
    await expect(page.locator('body')).toHaveCSS('background-color', background);
    await expectNoA11yViolations(page, `bacheca colorata ${theme}`);
    await page.screenshot({ path: info.outputPath(`board-${theme}.png`) });

    await page.reload();
    await expect(surface).toHaveAttribute('data-board-color', 'green');
    await page.getByRole('link', { name: 'Tabella', exact: true }).click();
    await expect(surface).toHaveAttribute('data-board-color', 'green');
    await expect(page.getByRole('group', { name: 'Densità delle schede' })).toHaveCount(0);
    await expectNoA11yViolations(page, `tabella nella bacheca ${theme}`);
    await page.goto('/boards/b2');
    await expect(surface).toHaveAttribute('data-board-color', 'rose');
    await page.getByRole('button', { name: 'Azioni della vista' }).click();
    await expect(
      page.getByRole('menuitem', { name: 'Cambia il background di Altra ricerca', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goto('/boards/b1');
    await expect(surface).toHaveAttribute('data-board-color', 'green');
  });

  test(`tutte le tinte mantengono leggibili i contenuti della tabella (${theme})`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.addInitScript((value) => localStorage.setItem('jobward-theme', value), theme);
    await page.goto('/boards/b1/table');
    for (const color of [null, ...COLOR_TOKENS]) {
      await openBackground(page);
      const dialog = page.getByRole('dialog', { name: 'Cambia background' });
      await dialog
        .getByRole('radio', { name: color === null ? 'Predefinito' : COLOR_LABELS[color] })
        .check();
      await dialog.getByRole('button', { name: 'Salva sfondo' }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByTestId('board-surface')).toHaveAttribute(
        'data-board-color',
        color ?? 'default',
      );
      await expectNoA11yViolations(page, `tinta ${color ?? 'default'} in ${theme}`);
    }
  });
}

test('titolo e azioni condividono posizione e dimensioni nelle viste del workspace', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const positions: { x: number; y: number; font: string; searchY: number; searchSize: number }[] =
    [];
  for (const path of ['/', '/boards', '/boards/b1', '/boards/b1/table', '/profile', '/help']) {
    await page.goto(path);
    const header = page.getByTestId('workspace-page-header');
    await expect(header.getByRole('heading', { level: 1 })).toBeVisible();
    if (path.startsWith('/boards/b1'))
      await expect(page.getByTestId('board-surface')).toBeVisible();
    await waitForAnimationsToSettle(page);
    const title = header.getByRole('heading', { level: 1 });
    const box = (await title.boundingBox())!;
    const search = (await header.getByRole('button', { name: 'Cerca in Jobward' }).boundingBox())!;
    if (path.startsWith('/boards/b1')) {
      const views = (await header
        .getByRole('navigation', { name: 'Visualizzazione della bacheca' })
        .boundingBox())!;
      expect(views.x).toBeGreaterThan(search.x + search.width);
      expect(views.y).toBeGreaterThanOrEqual(search.y);
      expect(views.y + views.height).toBeLessThanOrEqual(search.y + search.height);
      const boardBox = (await page.getByTestId('board-surface').boundingBox())!;
      expect(boardBox.y).toBeLessThan(110);
    }
    positions.push({
      x: box.x,
      y: box.y,
      font: await title.evaluate((el) => getComputedStyle(el).fontSize),
      searchY: search.y,
      searchSize: search.width,
    });
  }
  for (const position of positions) expect(position).toEqual(positions[0]);
});

test('board contenuta, zoom completo e selettore accessibile su telefono', async ({
  page,
}, info) => {
  await page.goto('/boards/b1');
  const surface = page.getByTestId('board-surface');
  const canvas = page.getByTestId('kanban');
  const zoom = page.getByRole('group', { name: 'Zoom della bacheca' });
  await zoom.getByRole('button', { name: 'Controlli zoom e vista' }).hover();
  await zoom.getByRole('button', { name: 'Mostra tutte le colonne' }).click();
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return [...element.querySelectorAll('[data-column-id]')].every((column) => {
          const bounds = column.getBoundingClientRect();
          return bounds.left >= box.left && bounds.right <= box.right;
        });
      }),
    )
    .toBe(true);
  for (const width of [1920, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const box = (await surface.boundingBox())!;
    expect(box.x).toBeGreaterThan(0);
    expect(box.x + box.width).toBeLessThan(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await openBackground(page);
  const dialog = page.getByRole('dialog', { name: 'Cambia background' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('radio', { name: 'Arancione' }).check();
  await expectNoA11yViolations(page, 'background su telefono');
  await page.screenshot({ path: info.outputPath('background-mobile.png') });
  await dialog.getByRole('button', { name: 'Annulla' }).click();
  await expect(surface).toHaveAttribute('data-board-color', 'blue');
});
