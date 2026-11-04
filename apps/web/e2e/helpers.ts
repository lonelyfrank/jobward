import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Verifica automatica WCAG 2.x A/AA (non sostituisce la verifica manuale). */
export async function expectNoA11yViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary, `Violazioni di accessibilità in "${label}"`).toEqual([]);
}

/** Garantisce che esista un workspace (i test non devono dipendere dall'ordine di esecuzione). */
export async function ensureWorkspace(page: Page, name = 'Ricerca E2E') {
  await page.goto('/');
  const onboarding = page.getByRole('heading', { name: 'Crea il tuo spazio di lavoro' });
  const shell = page.getByRole('navigation', { name: 'Navigazione principale' });
  await expect(onboarding.or(shell)).toBeVisible();
  if (await onboarding.isVisible()) {
    await page.getByLabel('Nome dello spazio').fill(name);
    await page.getByRole('button', { name: 'Crea workspace' }).click();
    await expect(shell).toBeVisible();
  }
}
