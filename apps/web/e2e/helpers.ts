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
