import { expect, test, type Page } from '@playwright/test';
import {
  cardLink,
  createBoard,
  ensureWorkspace,
  expectNoA11yViolations,
  openTab,
  quickAdd,
  seedApi,
  smallTouchTargets,
  transitionPipeline,
} from './helpers';

async function fixture(page: Page, suffix: string) {
  await ensureWorkspace(page);
  const api = await seedApi(page);
  const board = await api.board('Workflow C3 ' + suffix);
  const id = await api.card(board.columns[0]!.id, 'Candidatura C3 ' + suffix, {
    company: 'Azienda reale',
    jobTitle: 'Tecnico',
  });
  const path = `/boards/${board.id}/cards/${id}`;
  const url = (resource: string) => `/api/v1${resource}?workspaceId=${api.workspaceId}`;
  await page.goto(path);
  const panel = page.getByRole('dialog', { name: 'Candidatura C3 ' + suffix, exact: true });
  await expect(panel).toBeVisible();
  return { api, board, id, path, panel, url };
}
const alert = (page: Page) => page.getByRole('alertdialog');

test('A: opportunità creata dalla UI → invio → avanzamento → Kanban, tabella e timeline coerenti', async ({
  page,
}) => {
  await ensureWorkspace(page);
  await createBoard(page, 'C3 percorso completo');
  await quickAdd(page, 'Da fare', 'Tecnico C3 completo');
  await cardLink(page, 'Tecnico C3 completo').click();
  const panel = page.getByRole('dialog', { name: 'Tecnico C3 completo' });
  await panel.getByLabel('Stato di destinazione').selectOption('applied');
  await panel.getByRole('button', { name: 'Segna come candidata' }).click();
  await alert(page).getByLabel('Data di invio (facoltativa)').fill('2026-11-07');
  await alert(page).getByRole('button', { name: 'Conferma passaggio' }).click();
  await expect(panel.getByLabel('Fase', { exact: true })).toHaveValue('Inviata');
  await transitionPipeline(panel, 'advance', 'interviewing');
  await openTab(panel, 'Timeline');
  await expect(panel.getByText('Candidatura registrata (7 nov 2026)')).toBeVisible();
  await expect(panel.getByText('Fase cambiata da “Inviata” a “Colloquio”')).toBeVisible();
  const pathname = new URL(page.url()).pathname;
  await page.keyboard.press('Escape');
  const card = page
    .locator('[data-card-id]')
    .filter({ has: cardLink(page, 'Tecnico C3 completo') });
  await expect(card.getByText('In colloquio', { exact: true })).toBeVisible();
  await page.goto(pathname.replace(/\/cards\/[^/]+$/, '/table'));
  await expect(
    page
      .locator('tbody tr')
      .filter({ hasText: 'Tecnico C3 completo' })
      .getByText('In colloquio', { exact: true }),
  ).toBeVisible();
});

test('B: colloquio futuro → chiusura con conservazione → riapertura → chiusura con annullamento esplicito', async ({
  page,
}) => {
  const f = await fixture(page, 'colloqui');
  await openTab(f.panel, 'Colloqui');
  await f.panel.getByRole('button', { name: 'Aggiungi colloquio' }).click();
  const form = f.panel
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Nuovo colloquio' }) });
  await form.getByLabel('Titolo', { exact: true }).fill('Round futuro');
  await form.getByLabel('Data e ora', { exact: true }).fill('2027-06-10T10:00');
  await form.getByRole('button', { name: 'Aggiungi colloquio' }).click();
  await expect(f.panel.getByRole('article')).toContainText('Programmato');
  await transitionPipeline(f.panel, 'advance', 'interviewing');
  await transitionPipeline(f.panel, 'close', 'rejected'); // default keep
  await expect(f.panel.getByText('Hai conservato i colloqui futuri programmati.')).toBeVisible();
  await openTab(f.panel, 'Colloqui');
  await expect(f.panel.getByRole('article')).toContainText('Programmato');
  await expect(
    f.panel.getByRole('tabpanel', { name: /Colloqui/ }).getByText(/chiusa ma ha colloqui futuri/),
  ).toBeVisible();
  await transitionPipeline(f.panel, 'reopen', 'interviewing');
  await f.panel.getByLabel('Azione', { exact: true }).selectOption('close');
  await f.panel.getByLabel('Stato di destinazione').selectOption('withdrawn');
  await f.panel.getByRole('button', { name: 'Registra un esito' }).click();
  await expect(alert(page).getByLabel('Conserva i colloqui programmati')).toBeChecked();
  await alert(page).getByLabel('Annulla i colloqui futuri programmati').check();
  await expectNoA11yViolations(page, 'C3 conferma chiusura');
  await alert(page).getByRole('button', { name: 'Conferma passaggio' }).click();
  await expect(alert(page)).toBeHidden();
  await expect(f.panel.getByText('Hai annullato i colloqui futuri programmati.')).toBeVisible();
  await openTab(f.panel, 'Colloqui');
  await expect(f.panel.getByRole('article')).toContainText('Annullato');
  await openTab(f.panel, 'Timeline');
  await expect(f.panel.getByText('Candidatura riaperta')).toBeVisible();
  await expect(f.panel.getByText('Round 1 annullato')).toBeVisible();
});

test('C: note CRUD e documenti CRUD, URL esterno e bozze preservate fra schede', async ({
  page,
}) => {
  const f = await fixture(page, 'risorse');
  await openTab(f.panel, 'Note');
  await f.panel.getByRole('button', { name: 'Aggiungi nota' }).click();
  await f.panel.getByLabel('Testo della nota').fill('Nota iniziale');
  await openTab(f.panel, 'Documenti');
  await openTab(f.panel, 'Note');
  await expect(f.panel.getByLabel('Testo della nota')).toHaveValue('Nota iniziale');
  await f.panel.getByRole('button', { name: 'Salva nota' }).click();
  await expect(f.panel.getByText('Nota iniziale', { exact: true })).toBeVisible();
  await f.panel.getByRole('button', { name: 'Modifica nota' }).click();
  await f.panel.getByLabel('Testo della nota').fill('Nota modificata');
  await f.panel.getByRole('button', { name: 'Salva nota' }).click();
  await expect(f.panel.getByText('Nota modificata', { exact: true })).toBeVisible();
  await f.panel.getByRole('button', { name: 'Elimina nota' }).click();
  await alert(page).getByRole('button', { name: 'Elimina nota' }).click();
  await expect(f.panel.getByText('Nessuna nota registrata.')).toBeVisible();
  await openTab(f.panel, 'Documenti');
  await f.panel.getByRole('button', { name: 'Aggiungi riferimento' }).click();
  await f.panel.getByLabel('Titolo del documento').fill('Curriculum');
  await f.panel.getByLabel('Tipo di documento').selectOption('cv');
  await f.panel.getByLabel('URL (facoltativo)').fill('https://example.com/cv');
  await f.panel.getByRole('button', { name: 'Salva riferimento' }).click();
  await expect(f.panel.getByText('Curriculum', { exact: true })).toBeVisible();
  await f.panel.getByRole('button', { name: 'Modifica riferimento' }).click();
  await f.panel.getByLabel('Titolo del documento').fill('CV aggiornato');
  await f.panel.getByRole('button', { name: 'Salva riferimento' }).click();
  const link = f.panel.getByRole('link', { name: /Apri documento/ });
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  // Si apre davvero una scheda, senza dipendere dalla rete esterna durante la prova.
  await page
    .context()
    .route('https://example.com/cv', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>Documento di test</title>' }),
    );
  const popupPromise = page.waitForEvent('popup');
  await link.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL('https://example.com/cv');
  await popup.close();
  await f.panel.getByRole('button', { name: 'Elimina riferimento' }).click();
  await alert(page).getByRole('button', { name: 'Elimina riferimento' }).click();
  await expect(f.panel.getByText('Nessun riferimento documentale registrato.')).toBeVisible();
});

for (const resource of ['notes', 'documents', 'interviews', 'pipeline'] as const) {
  test(`D: risposta persa DOPO commit ${resource}: retry identico, nessun duplicato`, async ({
    page,
  }) => {
    const f = await fixture(page, 'retry-' + resource);
    const payloads: unknown[] = [];
    let first = true;
    await page.route(`**/api/v1/cards/${f.id}/${resource}?*`, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      payloads.push(route.request().postDataJSON());
      if (first) {
        first = false;
        const response = await route.fetch(); // la scrittura D1 è confermata prima della perdita
        expect(response.ok()).toBe(true);
        await route.abort('failed');
      } else await route.continue();
    });
    if (resource === 'notes') {
      await openTab(f.panel, 'Note');
      await f.panel.getByRole('button', { name: 'Aggiungi nota' }).click();
      await f.panel.getByLabel('Testo della nota').fill('Una sola nota');
      await f.panel.getByRole('button', { name: 'Salva nota' }).click();
    } else if (resource === 'documents') {
      await openTab(f.panel, 'Documenti');
      await f.panel.getByRole('button', { name: 'Aggiungi riferimento' }).click();
      await f.panel.getByLabel('Titolo del documento').fill('Un solo documento');
      await f.panel.getByRole('button', { name: 'Salva riferimento' }).click();
    } else if (resource === 'interviews') {
      await openTab(f.panel, 'Colloqui');
      await f.panel.getByRole('button', { name: 'Aggiungi colloquio' }).click();
      const form = f.panel
        .locator('form')
        .filter({ has: page.getByRole('heading', { name: 'Nuovo colloquio' }) });
      await form.getByLabel('Titolo', { exact: true }).fill('Un solo round');
      await form.getByRole('button', { name: 'Aggiungi colloquio' }).click();
    } else {
      await f.panel.getByLabel('Stato di destinazione').selectOption('applied');
      await f.panel.getByRole('button', { name: 'Segna come candidata' }).click();
      await alert(page).getByRole('button', { name: 'Conferma passaggio' }).click();
    }
    await expect(page.getByText(/l’operazione potrebbe essere riuscita/)).toBeVisible();
    const retryResponse = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/' + resource),
    );
    await page.getByRole('button', { name: 'Riprova la stessa richiesta' }).click();
    expect((await retryResponse).status()).toBe(200);
    expect(payloads).toHaveLength(2);
    expect(payloads[1]).toEqual(payloads[0]);
    expect((payloads[0] as { id: string }).id).toMatch(/^[\w-]{16,64}$/);
    if (resource === 'pipeline') {
      await openTab(f.panel, 'Timeline');
      await expect(f.panel.getByText('Candidatura registrata', { exact: true })).toHaveCount(1);
    } else {
      const response = await page.request.get(f.url(`/cards/${f.id}/${resource}`));
      const body = (await response.json()) as Record<string, unknown[]>;
      expect(body[resource]).toHaveLength(1);
    }
  });
}

test('409: aggiorna lo stato remoto e richiede una nuova operazione consapevole', async ({
  page,
}) => {
  const f = await fixture(page, 'concorrenza');
  await f.panel.getByLabel('Stato di destinazione').selectOption('applied');
  await f.panel.getByRole('button', { name: 'Segna come candidata' }).click();
  const remote = await page.request.post(f.url(`/cards/${f.id}/pipeline`), {
    data: { id: crypto.randomUUID(), to: 'offer', kind: 'advance', expectedFrom: 'saved' },
  });
  expect(remote.ok()).toBe(true);
  await alert(page).getByRole('button', { name: 'Conferma passaggio' }).click();
  await expect(alert(page).getByText(/cambiato nel frattempo/)).toBeVisible();
  await alert(page)
    .getByRole('button', { name: 'Aggiorna i dati e scegli una nuova operazione' })
    .click();
  await expect(alert(page)).toBeHidden();
  await expect(f.panel.getByLabel('Fase', { exact: true })).toHaveValue('Offerta');
  await transitionPipeline(f.panel, 'close', 'hired');
  await expect(f.panel.getByRole('list', { name: 'Stato della candidatura' })).toContainText(
    'Assunta',
  );
});

test('E: sei hash, alias legacy, refresh, back/forward, Kanban e Tabella', async ({ page }) => {
  const f = await fixture(page, 'navigazione');
  const tabs = [
    ['Colloqui', '#colloqui'],
    ['Timeline', '#timeline'],
    ['Note', '#note'],
    ['Documenti', '#documenti'],
    ['Dettagli', '#dettagli'],
  ] as const;
  for (const [name, hash] of tabs) {
    await openTab(f.panel, name);
    await expect(page).toHaveURL(f.path + hash);
  }
  await page.goBack();
  await expect(f.panel.getByRole('tab', { name: 'Documenti', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.goForward();
  await expect(f.panel.getByRole('tab', { name: 'Dettagli', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  for (const [name, hash] of [...tabs, ['Timeline', '#cronologia']] as const) {
    await page.goto(f.path + hash);
    await page.reload();
    await expect(f.panel.getByRole('tab', { name, exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  }
  await page.goto(`/boards/${f.board.id}/table`);
  await cardLink(page, 'Candidatura C3 navigazione').click();
  await openTab(f.panel, 'Note');
  await expect(page).toHaveURL(`/boards/${f.board.id}/table/cards/${f.id}#note`);
});

test('timeline e note paginate: cursori reali, nessun duplicato e nuovi eventi al refresh', async ({
  page,
}) => {
  const f = await fixture(page, 'pagine');
  for (let i = 0; i < 28; i++)
    expect(
      (
        await page.request.post(f.url(`/cards/${f.id}/notes`), {
          data: { id: crypto.randomUUID(), body: 'Nota paginata ' + i },
        })
      ).status(),
    ).toBe(201);
  const paths: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'GET' && /\/(notes|timeline)\?/.test(r.url())) paths.push(r.url());
  });
  await openTab(f.panel, 'Note');
  await expect(f.panel.getByRole('button', { name: 'Modifica nota' })).toHaveCount(25);
  await f.panel.getByRole('button', { name: 'Carica altre note' }).click();
  await expect(f.panel.getByRole('button', { name: 'Modifica nota' })).toHaveCount(28);
  await openTab(f.panel, 'Timeline');
  await f.panel.getByRole('button', { name: 'Carica altri eventi' }).click();
  await expect(f.panel.getByText('Nota aggiunta', { exact: true })).toHaveCount(28);
  expect(paths.some((p) => p.includes('/notes?limit=25') && p.includes('before='))).toBe(true);
  expect(paths.some((p) => p.includes('/timeline?limit=25') && p.includes('before='))).toBe(true);
  await page.request.post(f.url(`/cards/${f.id}/notes`), {
    data: { id: crypto.randomUUID(), body: 'Nota arrivata dopo' },
  });
  await f.panel.getByRole('button', { name: 'Aggiorna eventi' }).click();
  await expect(f.panel.getByText('Nota arrivata dopo', { exact: true })).toBeVisible();
});

for (const [width, height] of [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1366, 768],
  [1920, 1080],
]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`responsive ${width}×${height} ${theme}: sei schede, bozze, tastiera e accessibilità`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: width!, height: height! });
      await page.addInitScript((value) => localStorage.setItem('jobward-theme', value), theme);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const f = await fixture(page, `responsive-${width}-${theme}`);
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
      await f.panel.screenshot({ path: test.info().outputPath('overview.png') });
      for (const name of ['Panoramica', 'Colloqui', 'Timeline', 'Note', 'Documenti', 'Dettagli']) {
        await openTab(f.panel, name);
        await expect(page.getByRole('dialog')).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        if (width! < 768) expect(await smallTouchTargets(page, '[role=dialog]')).toEqual([]);
        await expectNoA11yViolations(page, `C3 ${width} ${theme} ${name}`);
      }
      await openTab(f.panel, 'Note');
      await f.panel.getByRole('button', { name: 'Aggiungi nota' }).click();
      await f.panel.getByLabel('Testo della nota').fill('Bozza lunga '.repeat(100));
      await openTab(f.panel, 'Documenti');
      await f.panel.getByRole('button', { name: 'Aggiungi riferimento' }).click();
      await f.panel.getByLabel('Titolo del documento').fill('Documento da non perdere');
      await openTab(f.panel, 'Note');
      await expect(f.panel.getByLabel('Testo della nota')).toHaveValue('Bozza lunga '.repeat(100));
      await f.panel.getByRole('button', { name: 'Chiudi', exact: true }).click();
      await expect(alert(page)).toContainText('Hai modifiche non salvate');
      await alert(page).getByRole('button', { name: 'Torna alla scheda' }).click();
      await expect(f.panel.getByLabel('Testo della nota')).toHaveValue('Bozza lunga '.repeat(100));
      await openTab(f.panel, 'Documenti');
      await expect(f.panel.getByLabel('Titolo del documento')).toHaveValue(
        'Documento da non perdere',
      );
      await expectNoA11yViolations(page, 'C3 editor documenti');
      await f.panel.screenshot({ path: test.info().outputPath('document-editor.png') });
    });
  }
}

test('dirty guard: back dalla modale, refresh annullato e focus dopo il salvataggio', async ({
  page,
}) => {
  const f = await fixture(page, 'dirty-guard');
  await page.goto(`/boards/${f.board.id}`);
  await cardLink(page, 'Candidatura C3 dirty-guard').click();
  await openTab(f.panel, 'Note');
  await f.panel.getByRole('button', { name: 'Aggiungi nota' }).click();
  await f.panel.getByLabel('Testo della nota').fill('Conservare durante la navigazione');
  await page.goBack(); // torna a Panoramica, la bozza resta montata
  await expect(f.panel.getByRole('tab', { name: 'Panoramica', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.goBack(); // uscita dalla modale: guardia applicativa
  await expect(alert(page)).toContainText('Hai modifiche non salvate');
  await alert(page).getByRole('button', { name: 'Torna alla scheda' }).click();
  await openTab(f.panel, 'Note');
  await expect(f.panel.getByLabel('Testo della nota')).toHaveValue(
    'Conservare durante la navigazione',
  );
  const nativeDialog = page.waitForEvent('dialog');
  // location.reload esercita il beforeunload reale senza attendere un evento load che,
  // quando l'utente annulla, non arriverà mai.
  const reload = page.evaluate(() => window.location.reload());
  const unload = await nativeDialog;
  expect(unload.type()).toBe('beforeunload');
  await unload.dismiss();
  await reload;
  await expect(f.panel.getByLabel('Testo della nota')).toHaveValue(
    'Conservare durante la navigazione',
  );
  await f.panel.getByRole('button', { name: 'Salva nota' }).click();
  await expect(f.panel.getByRole('button', { name: 'Aggiungi nota' })).toBeFocused();
  await openTab(f.panel, 'Documenti');
  await f.panel.getByRole('button', { name: 'Aggiungi riferimento' }).click();
  await f.panel.getByLabel('Titolo del documento').fill('Riferimento con focus');
  await f.panel.getByRole('button', { name: 'Salva riferimento' }).click();
  await expect(f.panel.getByRole('button', { name: 'Aggiungi riferimento' })).toBeFocused();
});
