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
  const shell = page
    .getByRole('navigation', { name: 'Navigazione principale' })
    .or(page.getByRole('button', { name: 'Apri il menu di navigazione' }));
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

/** Viste dello Storico: per raggiungerle si apre prima la scheda «Storico». */
const HISTORY_TAB: Record<string, string> = {
  Timeline: 'Tutto',
  Cronologia: 'Tutto',
  Storico: 'Tutto',
  Tutto: 'Tutto',
  Note: 'Note',
  Documenti: 'Documenti',
};

async function selectTab(panel: Locator, name: string) {
  const tab = panel.getByRole('tab', { name, exact: true }).first();
  await expect(async () => {
    if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
}

/**
 * Seleziona una scheda della modale della candidatura (Panoramica, Colloqui, Storico, Dettagli) o
 * una vista dello Storico (Timeline/Tutto, Note, Documenti), passando prima dallo Storico.
 */
export async function openTab(panel: Locator, name: string) {
  const view = HISTORY_TAB[name];
  if (view) {
    await selectTab(panel, 'Storico');
    await selectTab(panel, view);
    return;
  }
  const tab = panel.getByRole('tab', { name, exact: false }).first();
  await expect(async () => {
    if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
}

/**
 * Porta la scheda «Dettagli» in modifica (i gruppi di campi non sono più comprimibili: `name` resta
 * per leggibilità dei test). Se è già in modifica non fa nulla.
 */
export async function openSection(panel: Locator, _name?: string) {
  await openTab(panel, 'Dettagli');
  const edit = panel.getByRole('button', { name: 'Modifica', exact: true });
  if (await edit.isVisible()) await edit.click();
  await expect(panel.getByLabel('Titolo', { exact: true })).toBeVisible();
}

/** Salvataggio unico della modale: la barra in basso salva tutte le bozze, da qualunque scheda. */
export async function saveCard(panel: Locator) {
  const bar = panel.getByRole('region', { name: 'Modifiche da salvare' });
  await bar.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(bar).toBeHidden();
}

/** Fase ed esito mostrati nel pannello dello stato. */
export async function expectStageOutcome(panel: Locator, stage: string, outcome?: string) {
  await expect(panel.getByTestId('card-stage')).toHaveText(stage);
  if (outcome !== undefined) await expect(panel.getByTestId('card-outcome')).toHaveText(outcome);
}

/** Archivia dalla voce «Archivia» del menu «Altre azioni» della modale. */
export async function archiveFromPanel(panel: Locator) {
  await panel.getByRole('button', { name: 'Altre azioni' }).click();
  await panel.page().getByRole('menuitem', { name: 'Archivia' }).click();
}

/** Stato di pipeline equivalente a una coppia fase/esito (per preparare i dati via API). */
function targetStatus(stage?: string, outcome?: string): string {
  if (stage === 'closed' || (outcome && outcome !== 'pending')) {
    const closed: Record<string, string> = {
      rejected: 'rejected',
      withdrawn: 'withdrawn',
      no_response: 'no_response',
      accepted: 'hired',
      offer_declined: 'withdrawn',
    };
    return closed[outcome ?? ''] ?? 'rejected';
  }
  const open: Record<string, string> = {
    saved: 'saved',
    preparing: 'saved',
    applied: 'applied',
    in_contact: 'screening',
    interviewing: 'interviewing',
    offer: 'offer',
  };
  return open[stage ?? 'applied'] ?? 'applied';
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
      const { stage, outcome, appliedOn, ...rest } = details;
      if (Object.keys(rest).length > 0) await send('patch', `/cards/${card.id}`, rest);
      // Fase, esito e data d'invio sono della CANDIDATURA: la si crea e, se serve, si corregge lo stato.
      if (stage !== undefined || outcome !== undefined || appliedOn !== undefined) {
        await send('post', `/cards/${card.id}/applications`, {
          id: crypto.randomUUID(),
          stage: 'applied',
          ...(appliedOn ? { appliedOn } : {}),
        });
        const target = targetStatus(stage as string | undefined, outcome as string | undefined);
        if (target !== 'applied') {
          await send('post', `/cards/${card.id}/pipeline`, {
            id: crypto.randomUUID(),
            to: target,
            kind: 'correction',
          });
        }
      }
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
    /** Archivia una scheda (usata per non lasciare opportunità visibili agli spec successivi). */
    async archive(cardId: string) {
      await send('post', `/cards/${cardId}/archive`, {});
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
      let box = (isToggle ? (el.closest('label') ?? el) : el).getBoundingClientRect();
      // Un link "stretched" estende il target al suo containing block tramite ::after.
      // Si riconosce la geometria effettiva, senza esentare tutti i link delle card.
      const after = getComputedStyle(el, '::after');
      if (
        el.matches('a[href]') &&
        after.content !== 'none' &&
        after.position === 'absolute' &&
        after.pointerEvents !== 'none' &&
        [after.top, after.right, after.bottom, after.left].every((inset) => inset === '0px') &&
        el.offsetParent instanceof HTMLElement
      ) {
        box = el.offsetParent.getBoundingClientRect();
      }
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

/** Unico percorso UI per fase/esito: pipeline con conferma, anche per le regressioni M2/M2.5. */
export async function transitionPipeline(
  panel: Locator,
  kind: 'advance' | 'close' | 'reopen' | 'correction',
  to: string,
) {
  // Il pannello dello stato è sempre visibile da `lg`; sotto sta in cima alla Panoramica.
  await openTab(panel, 'Panoramica');
  const labels = {
    advance: 'Avanza nel processo',
    close: 'Registra un esito',
    reopen: 'Riapri candidatura',
    correction: 'Correggi stato',
  };
  await panel.getByRole('button', { name: labels[kind], exact: true }).click();
  await panel.page().locator(`[role="menuitem"][data-status="${to}"]`).click();
  const dialog = panel.page().getByRole('alertdialog');
  await dialog.getByRole('button', { name: 'Conferma passaggio' }).click();
  await expect(dialog).toBeHidden();
}
