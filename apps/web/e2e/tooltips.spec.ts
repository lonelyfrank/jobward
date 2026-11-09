import { expect, test } from '@playwright/test';
import { ensureWorkspace } from './helpers';

test('i tooltip spariscono sempre quando l’hover non è attivo', async ({ page }) => {
  await ensureWorkspace(page);
  await page.goto('/boards');
  const search = page.getByRole('button', { name: 'Cerca in Jobward' });
  // 1. hover → compare, uscita → sparisce
  await search.hover();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.mouse.move(640, 500);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  // 2. click apre il dialogo; chiuso con il mouse (X) il focus torna al pulsante: nessun tooltip
  await search.click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await page.mouse.move(640, 500);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  // 2b. stesso scenario col mouse sul pulsante mentre il dialogo si chiude: poi il mouse se ne va
  await search.hover();
  await search.click();
  await expect(dlg).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await page.mouse.move(640, 500);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  // 3. da tastiera il tooltip compare e sparisce quando il focus se ne va
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await search.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});
