import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Attende la fine delle animazioni FINITE (entrata di pagina, pannelli, menu). Axe calcola il
 * contrasto sul colore composto con l'opacità corrente: campionando a metà di un fade-in, il testo
 * secondario risulta più chiaro del reale e produce un falso positivo (visto in CI, M2-00).
 * Le animazioni infinite (skeleton) sono escluse: non terminano mai.
 */
export async function waitForAnimationsToSettle(page: Page) {
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.allSettled(finite.map((a) => a.finished));
  });
}

/** Verifica automatica WCAG 2.x A/AA (non sostituisce la verifica manuale). */
export async function expectNoA11yViolations(page: Page, label: string) {
  await waitForAnimationsToSettle(page);
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

/** Helper per il Kanban (M1). */
export const column = (page: Page, name: string) =>
  page.getByRole('region', { name, exact: true }).and(page.locator('[data-column-id]'));

export const cardLink = (page: Page, title: string) =>
  page.getByRole('link', { name: title, exact: true });

/** L'intera scheda (elemento della lista): è il bersaglio corretto per trascinare e rilasciare. */
export const cardItem = (page: Page, title: string) =>
  page.locator('[data-card-id]').filter({ has: cardLink(page, title) });

/** Titoli delle schede di una colonna, nell'ordine mostrato. */
export async function titlesIn(page: Page, name: string) {
  return page
    .getByRole('list', { name: `Schede in ${name}`, exact: true })
    .getByRole('link')
    .allTextContents();
}

/** Crea una bacheca dalla galleria e ne apre la vista. */
export async function createBoard(
  page: Page,
  name: string,
  template: 'Job Search Standard' | 'Minimal' | 'Personalizzata' = 'Minimal',
) {
  await page.goto('/boards');
  await page
    .getByRole('button', { name: /Nuova bacheca|Crea la tua prima bacheca/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: 'Nuova bacheca' });
  await dialog.getByLabel('Nome', { exact: true }).fill(name);
  await dialog.getByRole('radio', { name: new RegExp(template) }).check({ force: true });
  await dialog.getByRole('button', { name: 'Crea bacheca' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** Aggiunge una scheda con la creazione rapida di una colonna. */
export async function quickAdd(page: Page, columnName: string, title: string) {
  const col = column(page, columnName);
  const input = col.getByLabel(`Titolo della nuova scheda in ${columnName}`);
  if (!(await input.isVisible()))
    await col.getByRole('button', { name: /Aggiungi scheda/ }).click();
  await input.fill(title);
  await input.press('Enter');
  await expect(col.getByRole('link', { name: title, exact: true })).toBeVisible();
}

/** Trascina con il mouse da un elemento a un altro (movimenti intermedi: dnd-kit li richiede). */
export async function dragWithMouse(
  page: Page,
  from: ReturnType<Page['locator']>,
  to: ReturnType<Page['locator']>,
  options: { toPosition?: 'top' | 'center' | 'bottom' } = {},
) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  const targetY =
    options.toPosition === 'top'
      ? b.y + 4
      : options.toPosition === 'bottom'
        ? b.y + b.height - 4
        : b.y + b.height / 2;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, targetY, { steps: 14 });
  await page.mouse.up();
}
