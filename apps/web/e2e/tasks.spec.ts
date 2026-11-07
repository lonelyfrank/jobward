import { expect, test, type Page } from '@playwright/test';
import {
  ensureWorkspace,
  expectNoA11yViolations,
  openTab,
  seedApi,
  smallTouchTargets,
  transitionPipeline,
} from './helpers';

/**
 * Attività, follow-up e scadenze (M3 Tasks). Il workspace E2E è UNO solo per tutta la suite: ogni test
 * ripulisce le sue attività (annullandole) per non alterare le schermate degli altri file.
 */
const unique = () => Math.random().toString(36).slice(2, 8);
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function tasksApi(page: Page) {
  await ensureWorkspace(page);
  const seed = await seedApi(page);
  const ws = seed.workspaceId;
  const url = (path: string) => `/api/v1${path}${path.includes('?') ? '&' : '?'}workspaceId=${ws}`;
  const json = async (res: Awaited<ReturnType<typeof page.request.get>>): Promise<any> => {
    if (!res.ok()) throw new Error(`${res.url()} → ${res.status()} ${await res.text()}`);
    return res.json();
  };
  return {
    seed,
    ws,
    async today(): Promise<string> {
      return (await json(await page.request.get(url('/tasks/summary')))).asOf.today;
    },
    async create(data: Record<string, unknown>) {
      return (
        await json(
          await page.request.post(url('/tasks'), { data: { id: crypto.randomUUID(), ...data } }),
        )
      ).task;
    },
    async list(view: string, cardId?: string) {
      const q = `/tasks?view=${view}&limit=100${cardId ? `&cardId=${cardId}` : ''}`;
      return (await json(await page.request.get(url(q)))).tasks as { id: string; status: string }[];
    },
    async command(id: string, command: 'complete' | 'reopen' | 'cancel') {
      return json(await page.request.post(url(`/tasks/${id}/${command}`), { data: {} }));
    },
    async transition(cardId: string, to: string, kind: string, expectedFrom: string) {
      return json(
        await page.request.post(url(`/cards/${cardId}/pipeline`), {
          data: {
            id: crypto.randomUUID(),
            to,
            kind,
            expectedFrom,
            ...(to === 'rejected' ? { futureInterviews: 'keep' } : {}),
          },
        }),
      );
    },
    async archive(cardId: string) {
      return json(await page.request.post(url(`/cards/${cardId}/archive`), { data: {} }));
    },
    async restore(cardId: string) {
      return json(await page.request.post(url(`/cards/${cardId}/restore`), { data: {} }));
    },
    async cleanup() {
      for (const t of await this.list('done')) {
        await this.command(t.id, 'reopen');
        await this.command(t.id, 'cancel');
      }
      for (const t of await this.list('open')) await this.command(t.id, 'cancel');
    },
  };
}

test.afterEach(async ({ page }) => {
  const api = await tasksApi(page);
  await api.cleanup();
});

test('attività indipendente: crea, ricarica, completa, riapri', async ({ page }) => {
  const title = `Aggiornare il CV ${unique()}`;
  await ensureWorkspace(page);
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Nuova attività' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nuova attività' });
  await expect(dialog.getByLabel('Titolo')).toBeFocused();
  await dialog.getByLabel('Titolo').fill(title);
  await dialog.getByRole('button', { name: 'Domani' }).click();
  await dialog.getByRole('button', { name: 'Crea attività' }).click();
  await expect(dialog).toBeHidden();

  const row = () => page.locator('[data-task-row]').filter({ hasText: title });
  await expect(row()).toBeVisible();
  await expect(row().getByText(/^Domani/)).toBeVisible();
  await page.reload(); // persiste
  await expect(row()).toBeVisible();

  await row()
    .getByRole('button', { name: `Segna come completata: ${title}` })
    .click();
  await expect(row()).toHaveCount(1); // «Tutte» mostra le completate
  await expect(row().getByRole('button', { name: `Riapri: ${title}` })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Da fare', exact: true }).click();
  await expect(page).toHaveURL(/vista=da-fare/);
  await expect(row()).toHaveCount(0);
  await page.getByRole('button', { name: 'Completate', exact: true }).click();
  await row()
    .getByRole('button', { name: `Riapri: ${title}` })
    .click();
  await expect(row()).toHaveCount(0);
  await page.getByRole('button', { name: 'Da fare', exact: true }).click();
  await expect(row()).toBeVisible();
});

test('attività collegata: dalla Panoramica, con link alla candidatura e Timeline', async ({
  page,
}) => {
  const api = await tasksApi(page);
  const suffix = unique();
  const board = await api.seed.board(`Attività E2E ${suffix}`);
  const cardTitle = `Candidatura attività ${suffix}`;
  const cardId = await api.seed.card(board.columns[0]!.id, cardTitle, { company: 'Azienda E2E' });
  await page.goto(`/boards/${board.id}/cards/${cardId}`);
  const panel = page.getByRole('dialog', { name: cardTitle, exact: true });
  const section = panel.getByRole('region', { name: 'Attività della candidatura' });
  await expect(section.getByText('Nessuna attività aperta per questa candidatura.')).toBeVisible();

  await section.getByRole('button', { name: 'Aggiungi attività' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuova attività' });
  await expect(dialog.getByTestId('task-linked-card')).toContainText(cardTitle);
  await dialog.getByLabel('Titolo').fill(`Preparare domande ${suffix}`);
  await dialog.getByRole('button', { name: 'Crea attività' }).click();
  await expect(dialog).toBeHidden();
  await expect(
    section.getByRole('button', { name: `Preparare domande ${suffix}`, exact: true }),
  ).toBeVisible();

  // Timeline derivata dalla riga (D-06): creata.
  await openTab(panel, 'Timeline');
  await expect(panel.getByText('Attività creata')).toBeVisible();
  await openTab(panel, 'Panoramica');
  await section
    .getByRole('button', { name: `Segna come completata: Preparare domande ${suffix}` })
    .click();
  await expect(section.getByText('Nessuna attività aperta per questa candidatura.')).toBeVisible();
  await openTab(panel, 'Timeline');
  await expect(panel.getByText('Attività completata')).toBeVisible();

  // L'elenco generale mostra il collegamento e porta alla candidatura giusta.
  await page.goto('/tasks?vista=completate');
  const row = page.locator('[data-task-row]').filter({ hasText: `Preparare domande ${suffix}` });
  await row.getByRole('link', { name: new RegExp(cardTitle) }).click();
  await expect(page).toHaveURL(new RegExp(`/boards/${board.id}/cards/${cardId}`));
  await expect(page.getByRole('dialog', { name: cardTitle, exact: true })).toBeVisible();
});

test('follow-up da suggerimento: il suggerimento non crea nulla, la creazione è esplicita', async ({
  page,
}) => {
  const api = await tasksApi(page);
  const suffix = unique();
  const board = await api.seed.board(`Follow-up E2E ${suffix}`);
  const cardTitle = `Candidatura follow-up ${suffix}`;
  const cardId = await api.seed.card(board.columns[0]!.id, cardTitle, { company: 'Beta' });
  await api.transition(cardId, 'applied', 'advance', 'saved');
  await page.goto(`/boards/${board.id}/cards/${cardId}`);
  const panel = page.getByRole('dialog', { name: cardTitle, exact: true });
  const hint = panel.getByRole('complementary', { name: 'Suggerimento' });
  await expect(hint).toContainText('vuoi pianificare un follow-up');
  expect(await api.list('all', cardId)).toHaveLength(0); // il suggerimento NON ha creato nulla

  await hint.getByRole('button', { name: 'Pianifica' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuova attività' });
  await expect(dialog.getByLabel('Titolo')).toHaveValue('Follow-up: Beta');
  await expect(dialog.getByLabel('Scadenza', { exact: true })).not.toHaveValue('');
  expect(await api.list('all', cardId)).toHaveLength(0); // aprire il modulo non crea nulla
  await dialog.getByRole('button', { name: 'Crea attività' }).click();
  await expect(dialog).toBeHidden();
  await expect(hint).toHaveCount(0); // esiste ormai una follow-up: non si ripropone
  expect(await api.list('all', cardId)).toHaveLength(1);

  await page.goto('/tasks');
  const row = page.locator('[data-task-row]').filter({ hasText: 'Follow-up: Beta' });
  await expect(row.getByText('Follow-up', { exact: true })).toBeVisible();
});

test('«Non ora» nasconde il suggerimento e resta nascosto dopo il ricaricamento', async ({
  page,
}) => {
  const api = await tasksApi(page);
  const suffix = unique();
  const board = await api.seed.board(`Non ora E2E ${suffix}`);
  const cardTitle = `Candidatura non ora ${suffix}`;
  const cardId = await api.seed.card(board.columns[0]!.id, cardTitle);
  await api.transition(cardId, 'applied', 'advance', 'saved');
  await page.goto(`/boards/${board.id}/cards/${cardId}`);
  const hint = page.getByRole('complementary', { name: 'Suggerimento' });
  await hint.getByRole('button', { name: 'Non ora' }).click();
  await expect(hint).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Attività della candidatura' })).toBeVisible();
  await expect(hint).toHaveCount(0);
  expect(await api.list('all', cardId)).toHaveLength(0);
});

test('scadenza passata: «In ritardo», contatore e completata in ritardo', async ({ page }) => {
  const api = await tasksApi(page);
  const title = `Scaduta ${unique()}`;
  const today = await api.today();
  await api.create({ title, dueOn: addDays(today, -1) });
  await page.goto('/tasks');
  await expect(page.getByRole('button', { name: /^In ritardo\s*[1-9]/ })).toBeVisible();
  const overdue = page.getByRole('region', { name: /In ritardo/ });
  const row = overdue.locator('[data-task-row]').filter({ hasText: title });
  await expect(row.getByText('Scaduta ieri')).toBeVisible();
  await page.getByRole('button', { name: 'In ritardo', exact: true }).click();
  await expect(page).toHaveURL(/vista=in-ritardo/);
  await page.reload();
  await expect(page.locator('[data-task-row]').filter({ hasText: title })).toBeVisible();

  await page
    .locator('[data-task-row]')
    .filter({ hasText: title })
    .getByRole('button', { name: `Segna come completata: ${title}` })
    .click();
  await page.getByRole('button', { name: 'Completate', exact: true }).click();
  await expect(
    page
      .locator('[data-task-row]')
      .filter({ hasText: title })
      .getByText(/\(in ritardo\)/),
  ).toBeVisible();
});

test('la chiusura della candidatura informa ma non completa né annulla; completare non cambia la pipeline', async ({
  page,
}) => {
  const api = await tasksApi(page);
  const suffix = unique();
  const board = await api.seed.board(`Chiusura E2E ${suffix}`);
  const cardTitle = `Candidatura chiusura ${suffix}`;
  const cardId = await api.seed.card(board.columns[0]!.id, cardTitle);
  const task = await api.create({ title: `Ringraziare ${suffix}`, cardId, kind: 'follow_up' });
  await page.goto(`/boards/${board.id}/cards/${cardId}`);
  const panel = page.getByRole('dialog', { name: cardTitle, exact: true });
  await panel.getByLabel('Azione', { exact: true }).selectOption('close');
  await panel.getByLabel('Stato di destinazione').selectOption('rejected');
  await panel.getByRole('button', { name: 'Registra un esito', exact: true }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm.getByTestId('linked-tasks-notice')).toContainText(
    '1 attività aperta collegata',
  );
  await confirm.getByRole('button', { name: 'Conferma passaggio' }).click();
  await expect(confirm).toBeHidden();
  expect((await api.list('open', cardId)).map((t) => t.id)).toEqual([task.id]); // ancora aperta

  const section = panel.getByRole('region', { name: 'Attività della candidatura' });
  await section
    .getByRole('button', { name: `Segna come completata: Ringraziare ${suffix}` })
    .click();
  await expect(section.getByText('Nessuna attività aperta per questa candidatura.')).toBeVisible();
  await expect(panel.getByText('Rifiutata').first()).toBeVisible(); // la pipeline non è cambiata
  await transitionPipeline(panel, 'reopen', 'applied');
});

test('archiviazione: task escluse dall’elenco e in sola lettura; il ripristino le riporta', async ({
  page,
}) => {
  const api = await tasksApi(page);
  const suffix = unique();
  const board = await api.seed.board(`Archivio E2E ${suffix}`);
  const cardTitle = `Candidatura archivio ${suffix}`;
  const cardId = await api.seed.card(board.columns[0]!.id, cardTitle);
  await api.create({ title: `Legata ${suffix}`, cardId });
  await api.create({ title: `Libera ${suffix}` });

  await api.archive(cardId);
  await page.goto('/tasks');
  await expect(
    page.locator('[data-task-row]').filter({ hasText: `Libera ${suffix}` }),
  ).toBeVisible();
  await expect(page.locator('[data-task-row]').filter({ hasText: `Legata ${suffix}` })).toHaveCount(
    0,
  );

  await page.goto(`/boards/${board.id}/cards/${cardId}`);
  const panel = page.getByRole('dialog', { name: cardTitle, exact: true });
  const section = panel.getByRole('region', { name: 'Attività della candidatura' });
  await expect(section.getByText(/in sola lettura/)).toBeVisible();
  await expect(
    section.getByRole('button', { name: `Segna come completata: Legata ${suffix}` }),
  ).toBeDisabled();
  await expect(section.getByRole('button', { name: 'Aggiungi attività' })).toHaveCount(0);

  await api.restore(cardId);
  await page.goto('/tasks');
  await expect(
    page.locator('[data-task-row]').filter({ hasText: `Legata ${suffix}` }),
  ).toBeVisible();
});

test('modifica concorrente: 409 con ricarica dei dati e bozza conservata', async ({ page }) => {
  const api = await tasksApi(page);
  const title = `Concorrente ${unique()}`;
  const task = await api.create({ title });
  await page.goto('/tasks');
  await page.getByRole('button', { name: title, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifica attività' });
  await dialog.getByLabel('Titolo').fill(`${title} (mia modifica)`);
  // Un'altra scheda del browser modifica la stessa attività: il token della mia bozza è scaduto.
  await page.request.patch(`/api/v1/tasks/${task.id}?workspaceId=${api.ws}`, {
    data: { expectedUpdatedAt: task.updatedAt, priority: 'high' },
  });
  await dialog.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(dialog.getByRole('alert')).toContainText('cambiata nel frattempo');
  await dialog.getByRole('button', { name: 'Ricarica i dati più recenti' }).click();
  await expect(dialog.getByLabel('Titolo')).toHaveValue(`${title} (mia modifica)`);
  await dialog.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole('button', { name: `${title} (mia modifica)`, exact: true }),
  ).toBeVisible();
});

test('bozza protetta: Esc con modifiche chiede conferma', async ({ page }) => {
  await ensureWorkspace(page);
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Nuova attività' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nuova attività' });
  await dialog.getByLabel('Titolo').fill('Una bozza');
  await page.keyboard.press('Escape');
  const confirm = page.getByRole('alertdialog', { name: 'Hai modifiche non salvate' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Annulla' }).click();
  await expect(dialog.getByLabel('Titolo')).toHaveValue('Una bozza');
  await page.keyboard.press('Escape');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Esci senza salvare' }).click();
  await expect(dialog).toBeHidden();
});

test('solo tastiera: creazione rapida, completamento e menu', async ({ page }) => {
  const title = `Da tastiera ${unique()}`;
  await ensureWorkspace(page);
  await page.goto('/tasks');
  await page.getByLabel('Aggiungi un’attività').focus();
  await page.keyboard.type(title);
  await page.keyboard.press('Enter');
  const row = page.locator('[data-task-row]').filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: `Segna come completata: ${title}` }).focus();
  await page.keyboard.press('Space');
  await expect(row.getByRole('button', { name: `Riapri: ${title}` })).toBeVisible();
  await row.getByRole('button', { name: `Altre azioni per: ${title}` }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Riapri' })).toBeVisible();
  await page.keyboard.press('Escape');
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 390, 768, 1024, 1366, 1920] as const) {
    test(`responsive e accessibilità: ${width}px, tema ${theme}`, async ({ page }) => {
      const api = await tasksApi(page);
      const today = await api.today();
      const suffix = unique();
      await api.create({ title: `Scaduta ${suffix}`, dueOn: addDays(today, -2), priority: 'high' });
      await api.create({ title: `Oggi ${suffix}`, dueOn: today, kind: 'follow_up' });
      await api.create({
        title: `Senza data ${suffix} con un titolo davvero molto lungo da mandare a capo senza rompere la riga`,
      });
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
      await page.goto('/tasks');
      await expect(
        page.locator('[data-task-row]').filter({ hasText: `Oggi ${suffix}` }),
      ).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'nessuno scorrimento orizzontale della pagina').toBeLessThanOrEqual(0);
      if (width < 768) expect(await smallTouchTargets(page, 'main')).toEqual([]);
      await expectNoA11yViolations(page, `Attività ${width}px ${theme}`);

      await page.getByRole('button', { name: 'Nuova attività' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Nuova attività' });
      await expect(dialog.getByRole('button', { name: 'Crea attività' })).toBeVisible();
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      await expectNoA11yViolations(page, `Dialog attività ${width}px ${theme}`);
      await page.keyboard.press('Escape');
    });
  }
}

test('navigazione da telefono: drawer → Attività, filtri scorrevoli dentro se stessi', async ({
  page,
}) => {
  await ensureWorkspace(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Apri il menu di navigazione' }).click();
  await page
    .getByRole('dialog', { name: 'Menu di navigazione' })
    .getByRole('link', { name: 'Attività', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Attività' })).toBeVisible();
  const group = page.getByRole('group', { name: 'Filtro delle attività' });
  await expect(group).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
