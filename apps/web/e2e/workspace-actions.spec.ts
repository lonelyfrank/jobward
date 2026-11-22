import { test, expect } from '@playwright/test';
import { ensureWorkspace, expectNoA11yViolations, seedApi, smallTouchTargets } from './helpers';

test.beforeEach(async ({ page }) => {
  await ensureWorkspace(page);
});

test('header senza navbar nelle cinque viste, ricerca e menu coerenti', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const path of ['/', '/boards', '/opportunities', '/tasks', '/insights']) {
    await page.goto(path);
    const header = page.getByTestId('workspace-page-header');
    await expect(header).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByTestId('topbar-title')).toHaveCount(0);
    await header.getByRole('button', { name: 'Cerca in Jobward' }).click();
    const input = page.getByRole('combobox', { name: 'Cerca in Jobward' });
    await expect(input).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(header.getByRole('button', { name: 'Cerca in Jobward' })).toBeFocused();
    if (['/tasks', '/insights'].includes(path))
      await expect(header.getByRole('button', { name: 'Azioni della vista' })).toHaveCount(0);
    else {
      await header.getByRole('button', { name: 'Azioni della vista' }).click();
      await expect(page.getByRole('menu')).toBeVisible();
      await expect(page.getByRole('menuitem')).not.toHaveCount(0);
      await page.keyboard.press('Escape');
    }
  }
  expect(errors).toEqual([]);
});

test('ricerca reale cross-board, tastiera, focus trap, apertura di schede e colloqui', async ({
  page,
}) => {
  const api = await seedApi(page);
  const first = await api.board('Primo workspace search');
  const second = await api.board('Città workspace search');
  const card = await api.card(second.columns[0]!.id, 'Tecnico CÀFFÈ workspace search', {
    company: 'Orbita',
    stage: 'applied',
  });
  const interview = await page.request.post(
    `/api/v1/cards/${card}/interviews?workspaceId=${api.workspaceId}`,
    { data: { title: 'Tecnico reti workspace search', type: 'technical' } },
  );
  expect(interview.ok()).toBe(true);
  await page.goto(`/boards/${first.id}`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Primo workspace search' }),
  ).toBeVisible();
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox', { name: 'Cerca in Jobward' });
  await expect(input).toBeFocused();
  await input.fill('caffe');
  const option = page
    .getByRole('group', { name: 'Opportunità', exact: true })
    .getByRole('option', { name: /Tecnico CÀFFÈ workspace search/ });
  await expect(option).toHaveAttribute('aria-selected', 'true');
  await expectNoA11yViolations(page, 'ricerca globale con risultati');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(input).toBeFocused();
  await input.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/boards/${second.id}/cards/${card}$`));
  await expect(page.getByRole('dialog', { name: 'Tecnico CÀFFÈ workspace search' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Tecnico CÀFFÈ workspace search' })).toHaveCount(0);
  await page.keyboard.press('Meta+k');
  await input.fill('orbita');
  await expect(page.getByRole('group', { name: 'Colloqui', exact: true })).toBeVisible();
  await input.press('ArrowUp');
  await expect(page.getByRole('option', { name: /Tecnico reti workspace search/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await input.press('Enter');
  await expect(page).toHaveURL(/#colloqui$/);
  await expect(page.getByRole('tab', { name: /Colloqui/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('debounce, richieste obsolete, errore e chiusura overlay', async ({ page }) => {
  let calls = 0;
  let aborted = false;
  page.on('requestfailed', (request) => {
    if (request.url().includes('/search?')) aborted = true;
  });
  await page.route('**/api/v1/search?**', async (route) => {
    calls++;
    const q = new URL(route.request().url()).searchParams.get('q');
    if (q === 'lenta') {
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    await route
      .fulfill({
        json:
          q === 'lenta'
            ? {
                opportunities: [],
                boards: [{ id: 'b1', title: 'Obsoleto', subtitle: '' }],
                interviews: [],
              }
            : { opportunities: [], boards: [], interviews: [] },
      })
      .catch(() => {});
  });
  await page.getByRole('button', { name: 'Cerca in Jobward' }).click();
  const input = page.getByRole('combobox');
  await input.pressSequentially('lenta', { delay: 20 });
  expect(calls).toBe(0);
  await expect.poll(() => calls).toBe(1);
  await input.fill('nuova');
  await expect(page.getByText('Nessun risultato per “nuova”.')).toBeVisible();
  await expect(page.getByRole('option')).toHaveCount(0);
  await expect.poll(() => aborted).toBe(true);
  await page.unroute('**/api/v1/search?**');
  await page.route('**/api/v1/search?**', (route) =>
    route.fulfill({ status: 403, json: { error: { code: 'forbidden', message: 'x' } } }),
  );
  await input.fill('errore');
  await expect(page.getByRole('alert')).toContainText('Non riusciamo a cercare');
  await page.mouse.click(5, 5);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [768, 1024],
    [390, 844],
    [320, 568],
  ]) {
    test(`ricerca e menu accessibili ${theme} ${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width: width!, height: height! });
      await page.evaluate((value) => localStorage.setItem('jobward-theme', value), theme);
      await page.reload();
      const trigger = page.getByRole('button', { name: 'Cerca in Jobward' });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Cerca in Jobward' });
      await expect(dialog).toBeVisible();
      await expectNoA11yViolations(page, `ricerca ${theme} ${width}`);
      if (width! < 768) expect(await smallTouchTargets(page, '[role="dialog"]')).toEqual([]);
      const bounds = (await dialog.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width!);
      if (process.env['WORKSPACE_VISUAL_DIR'])
        await page.screenshot({
          path: `${process.env['WORKSPACE_VISUAL_DIR']}/search-${theme}-${width}x${height}.png`,
        });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Azioni della vista' }).click();
      await expectNoA11yViolations(page, `azioni ${theme} ${width}`);
      const menu = (await page.getByRole('menu').boundingBox())!;
      expect(menu.x).toBeGreaterThanOrEqual(0);
      expect(menu.x + menu.width).toBeLessThanOrEqual(width!);
      if (process.env['WORKSPACE_VISUAL_DIR'])
        await page.screenshot({
          path: `${process.env['WORKSPACE_VISUAL_DIR']}/actions-${theme}-${width}x${height}.png`,
        });
    });
  }
}
