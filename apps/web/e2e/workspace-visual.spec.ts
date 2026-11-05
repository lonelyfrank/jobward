import { test, expect } from '@playwright/test';
import { ensureWorkspace, seedApi, waitForAnimationsToSettle } from './helpers';

const output = process.env['WORKSPACE_VISUAL_DIR'];
test.skip(!output, 'Imposta WORKSPACE_VISUAL_DIR per il confronto prima/dopo.');

test('workspace: cinque viste, temi e viewport', async ({ page }) => {
  test.setTimeout(180_000);
  await ensureWorkspace(page, 'Ricerca 2026');
  const api = await seedApi(page);
  const board = await api.board('Ricerca autunno');
  await api.card(board.columns[0]!.id, 'Frontend Engineer', {
    company: 'Orbita Labs',
    location: 'Milano',
  });
  const views = [
    ['overview', '/'],
    ['bacheche', '/boards'],
    ['kanban', `/boards/${board.id}`],
    ['opportunita', '/opportunities'],
    ['attivita', '/tasks'],
    ['insights', '/insights'],
  ];
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => localStorage.setItem('jobward-theme', value), theme);
    for (const [width, height] of [
      [1920, 1080],
      [1366, 768],
      [768, 1024],
      [390, 844],
      [320, 568],
    ]) {
      await page.setViewportSize({ width: width!, height: height! });
      for (const [name, path] of views) {
        await page.goto(path!);
        await expect(page.locator('main h1')).toBeVisible();
        await expect(page.getByRole('status', { name: /Caricamento/ })).toHaveCount(0);
        await waitForAnimationsToSettle(page);
        await page.screenshot({ path: `${output}/${name}-${theme}-${width}x${height}.png` });
      }
    }
  }
  if (process.env['WORKSPACE_VISUAL_EXTRAS']) {
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => localStorage.setItem('jobward-theme', value), theme);
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto('/opportunities');
      await page.getByRole('button', { name: 'Cerca in Jobward' }).click();
      await page.getByRole('combobox').fill('Frontend');
      await expect(page.getByRole('option', { name: /Frontend Engineer/ })).toBeVisible();
      await waitForAnimationsToSettle(page);
      await page.screenshot({ path: `${output}/search-results-${theme}-1366x768.png` });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Azioni della vista' }).click();
      await waitForAnimationsToSettle(page);
      await page.screenshot({ path: `${output}/actions-${theme}-1366x768.png` });
      await page.keyboard.press('Escape');
    }
  }
});
