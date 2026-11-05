import { expect, test } from '@playwright/test';
import { ensureWorkspace, expectNoA11yViolations, waitForAnimationsToSettle } from './helpers';

test('marchio originale: temi, proporzioni, simbolo compatto e navigazione mobile', async ({
  page,
}, info) => {
  await ensureWorkspace(page);
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((value) => localStorage.setItem('jobward-theme', value), theme);
    await page.reload();
    const logo = page.locator('img[alt="Jobward"]:visible');
    await expect(logo).toHaveCount(1);
    await expect(logo).toBeVisible();
    await expect
      .poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    const ratio = await logo.evaluate(
      (img) => img.getBoundingClientRect().width / img.getBoundingClientRect().height,
    );
    expect(ratio).toBeCloseTo(3, 1);
    await expectNoA11yViolations(page, `brand ${theme}`);
    await page.screenshot({ path: info.outputPath(`brand-${theme}.png`) });
  }
  await page.getByRole('button', { name: 'Comprimi la barra laterale' }).click();
  await expect(page.locator('svg[aria-label="Jobward"]')).toBeVisible();
  await waitForAnimationsToSettle(page);
  await page.screenshot({ path: info.outputPath('brand-collapsed.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Apri il menu di navigazione' }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Menu di navigazione' })
      .getByRole('img', { name: 'Jobward', exact: true }),
  ).toBeVisible();
  await waitForAnimationsToSettle(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('brand-mobile.png') });
  const favicon = await page.request.get('/favicon.svg');
  expect(favicon.status()).toBe(200);
  expect(await favicon.text()).toContain('data:image/png;base64,');
});
