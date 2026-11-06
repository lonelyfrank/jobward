import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';

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
  await page.getByRole('button', { name: 'Azioni della vista' }).click();
  await page.getByRole('menuitem', { name: 'Nuova bacheca' }).click();
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

/** Seleziona una scheda della modale della candidatura (Panoramica, Colloqui, Dettagli, Cronologia). */
export async function openTab(panel: Locator, name: string) {
  const tab = panel.getByRole('tab', { name, exact: false }).first();
  await expect(async () => {
    if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
}

const SECTION_TAB: Record<string, string> = {
  Opportunità: 'Dettagli',
  Candidatura: 'Dettagli',
  'Campi personalizzati': 'Dettagli',
};

/**
 * Apre una sezione comprimibile della scheda «Dettagli» (le sezioni vuote partono chiuse; passa
 * prima alla scheda giusta). Alcune si aprono da sole quando arrivano i dati: si riprova finché è
 * aperta, così un clic non può chiudere ciò che nel frattempo si è aperto.
 */
export async function openSection(panel: Locator, name: string) {
  const tab = SECTION_TAB[name];
  if (tab) await openTab(panel, tab);
  const toggle = panel.getByRole('button', { name, exact: false }).first();
  await expect(async () => {
    if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
}

/**
 * Client API per preparare i dati dei test (velocità): stessa origine del browser, quindi stessa
 * autenticazione di sviluppo. I flussi sotto test restano quelli dell'interfaccia.
 */
export async function seedApi(page: Page) {
  const me = await (await page.request.get('/api/v1/me')).json();
  const ws = me.workspaces[0].id as string;
  const url = (path: string) => `/api/v1${path}${path.includes('?') ? '&' : '?'}workspaceId=${ws}`;
  const send = async (method: 'post' | 'patch' | 'put', path: string, data: unknown) => {
    const res = await page.request[method](url(path), { data });
    if (!res.ok()) throw new Error(`${method} ${path} → ${res.status()} ${await res.text()}`);
    return res.json();
  };
  const get = async (path: string) => {
    const res = await page.request.get(url(path));
    if (!res.ok()) throw new Error(`get ${path} → ${res.status()} ${await res.text()}`);
    return res.json();
  };
  return {
    workspaceId: ws,
    /** Id della bacheca con questo nome, se esiste: serve a rendere ripetibile la preparazione dei dati. */
    async findBoard(name: string) {
      const { boards } = (await get('/boards')) as { boards: { id: string; name: string }[] };
      return boards.find((b) => b.name === name)?.id ?? null;
    },
    async board(name: string) {
      const created = await send('post', '/boards', { name, templateId: 'minimal' });
      const columns = created.columns as { id: string; name: string }[];
      return { id: created.board.id as string, columns };
    },
    async card(columnId: string, title: string, details: Record<string, unknown> = {}) {
      const card = (await send('post', '/cards', { columnId, title })).card;
      if (Object.keys(details).length > 0) await send('patch', `/cards/${card.id}`, details);
      return card.id as string;
    },
    /**
     * Idempotente: un gruppo di test `serial` che fallisce viene rieseguito da capo (con i suoi
     * `beforeAll`) su un database che conserva i dati del primo tentativo. Un'etichetta già
     * presente con lo stesso nome (409) è riutilizzata invece di far fallire il secondo tentativo.
     */
    async label(name: string, color = 'slate') {
      const res = await page.request.post(url('/labels'), { data: { name, color } });
      if (res.ok()) return (await res.json()).label.id as string;
      if (res.status() === 409) {
        const { labels } = (await get('/labels')) as { labels: { id: string; name: string }[] };
        const existing = labels.find((l) => l.name === name);
        if (existing) return existing.id;
      }
      throw new Error(`post /labels → ${res.status()} ${await res.text()}`);
    },
    async assign(cardId: string, labelId: string) {
      await send('post', `/cards/${cardId}/labels`, { labelId });
    },
  };
}

/** Titoli delle righe della tabella (desktop), nell'ordine mostrato. */
export async function tableTitles(page: Page) {
  return page.locator('table tbody tr th[scope="row"] a').allTextContents();
}

/**
 * Controlli interattivi visibili con un lato inferiore a 44 px (WCAG 2.5.8 / uso a telefono).
 * Le caselle e i radio contano con la loro etichetta cliccabile; i link nel testo corrente sono esclusi.
 */
export async function smallTouchTargets(page: Page, rootSelector: string) {
  return page.evaluate((root) => {
    const out: string[] = [];
    const scope = document.querySelector(root);
    if (!scope) return ['(area non trovata)'];
    for (const el of scope.querySelectorAll<HTMLElement>(
      'a[href], button, select, input:not([type=hidden]), textarea, summary',
    )) {
      if (el.matches('.sr-only, .sr-only *') || el.closest('p, [hidden]')) continue;
      const isToggle = el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type);
      const box = (isToggle ? (el.closest('label') ?? el) : el).getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (Math.min(box.width, box.height) < 43.5) {
        const name =
          el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.getAttribute('id');
        out.push(
          `${el.tagName} "${(name ?? '').slice(0, 28)}" ${Math.round(box.width)}x${Math.round(box.height)}`,
        );
      }
    }
    return out;
  }, rootSelector);
}
