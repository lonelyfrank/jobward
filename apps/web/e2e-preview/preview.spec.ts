import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { openTab, transitionPipeline } from '../e2e/helpers';

test.describe.configure({ mode: 'serial' });

/** Legge i valori dichiarati nel blocco `/*` di public/_headers: la fonte di verità. */
function declaredHeaders(): Record<string, string> {
  const file = readFileSync(path.resolve(import.meta.dirname, '../public/_headers'), 'utf8');
  const block = file.split('\n').filter((l) => /^\s+[A-Za-z-]+:\s/.test(l));
  return Object.fromEntries(
    block.map((l) => {
      const [name, ...rest] = l.trim().split(':');
      return [name!.toLowerCase(), rest.join(':').trim()];
    }),
  );
}

const WATCHED = [
  'content-security-policy',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'strict-transport-security',
  'cross-origin-opener-policy',
  'permissions-policy',
] as const;

test.describe('header e instradamento (Workers Static Assets)', () => {
  test('_headers viene applicato a pagina, fallback SPA e asset', async ({ request }) => {
    const declared = declaredHeaders();
    for (const name of WATCHED)
      expect(declared[name], `${name} dichiarato in _headers`).toBeTruthy();

    for (const url of ['/', '/boards', '/settings', '/favicon.svg', '/theme-init.js']) {
      const res = await request.get(url);
      expect(res.status(), url).toBe(200);
      for (const name of WATCHED) {
        expect(res.headers()[name], `${name} su ${url}`).toBe(declared[name]);
      }
    }
  });

  test('la CSP non contiene scorciatoie pericolose', async ({ request }) => {
    const csp = (await request.get('/')).headers()['content-security-policy']!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/script-src[^;]*('unsafe-inline'|'unsafe-eval'|\*)/);
    expect(csp).not.toMatch(/default-src[^;]*\*/);
    // Debito noto e documentato: gli stili inline (Radix) richiedono 'unsafe-inline' su style-src.
    expect(csp).toMatch(/style-src 'self' 'unsafe-inline';/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  test('il fallback SPA serve index.html per i percorsi dell’app e l’API risponde dal Worker', async ({
    request,
  }) => {
    const page = await request.get('/opportunities');
    expect(page.headers()['content-type']).toContain('text/html');
    expect(await page.text()).toContain('<div id="root">');

    const health = await request.get('/api/health');
    expect(health.headers()['content-type']).toContain('application/json');
    expect(await health.json()).toEqual({ status: 'ok' });

    // Un percorso /api sconosciuto NON deve ricadere nell'HTML della SPA.
    const unknown = await request.get('/api/v1/non-esiste');
    expect(unknown.status()).toBe(404);
    expect(unknown.headers()['content-type']).toContain('application/json');
    expect(await unknown.json()).toMatchObject({ error: { code: 'not_found' } });
    // ...e gli header dell'API sono quelli del Worker.
    expect(unknown.headers()['cache-control']).toBe('no-store');
    expect(unknown.headers()['x-frame-options']).toBe('DENY');
  });

  test('un asset con hash mancante non viene reso cacheable "per sempre"', async ({ request }) => {
    const res = await request.get('/assets/index-VECCHIOHASH.js');
    expect(res.headers()['cache-control'] ?? '').not.toMatch(/immutable|max-age=(?!0)\d+/);
  });

  test('gli asset reali sono rivalidabili (ETag) e hanno il tipo MIME corretto', async ({
    request,
  }) => {
    const html = await (await request.get('/')).text();
    const js = /src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
    const css = /href="(\/assets\/[^"]+\.css)"/.exec(html)?.[1];
    expect(js && css, 'index.html referenzia JS e CSS con hash').toBeTruthy();
    const jsRes = await request.get(js!);
    expect(jsRes.headers()['content-type']).toMatch(/javascript/);
    expect(jsRes.headers()['etag']).toBeTruthy();
    expect((await request.get(css!)).headers()['content-type']).toContain('text/css');
    const cond = await request.get(js!, { headers: { 'if-none-match': jsRes.headers()['etag']! } });
    expect(cond.status()).toBe(304);
  });

  test('il file _headers non è esposto come contenuto', async ({ request }) => {
    const res = await request.get('/_headers');
    expect(await res.text()).not.toContain('Content-Security-Policy');
  });
});

async function watchViolations(page: Page) {
  const issues: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      ((window as unknown as { __csp: string[] }).__csp ??= []).push(
        `${e.violatedDirective} ${e.blockedURI}`,
      );
    });
  });
  page.on('console', (m) => {
    if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text()))
      issues.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => issues.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    // Una richiesta ANNULLATA di proposito (ricerca superata da un'altra, componente smontato:
    // AbortSignal di TanStack Query) è un comportamento previsto, non un errore di rete.
    if (r.failure()?.errorText.includes('ERR_ABORTED')) return;
    issues.push(`requestfailed: ${r.url()}`);
  });
  return {
    issues,
    collect: async () => [
      ...issues,
      ...(
        await page.evaluate((): string[] => (window as unknown as { __csp?: string[] }).__csp ?? [])
      ).map((v) => `CSP: ${v}`),
    ],
  };
}

test.describe('app reale sotto la CSP di produzione', () => {
  test('onboarding, navigazione, menu, tema e drawer mobile senza violazioni CSP né errori', async ({
    page,
  }) => {
    const watch = await watchViolations(page);
    await page.emulateMedia({ colorScheme: 'light' });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Crea il tuo spazio di lavoro' })).toBeVisible();
    await page.getByLabel('Nome dello spazio').fill('Anteprima');
    await page.getByRole('button', { name: 'Crea workspace' }).click(); // POST same-origin dal browser
    await expect(page.getByRole('heading', { name: 'Inizia da qui' })).toBeVisible();

    const nav = page.getByRole('navigation', { name: 'Navigazione principale' });
    for (const link of ['Bacheche', 'Opportunità', 'Attività', 'Insights']) {
      await nav.getByRole('link', { name: link }).click();
      await expect(page.getByRole('heading', { level: 1, name: link })).toBeVisible();
    }

    // Il menu account naviga; il tema si sceglie nelle Impostazioni.
    const account = page.getByRole('button', { name: /^Menu account/ });
    await account.click();
    const menu = page.getByRole('menu', { name: 'Menu account' });
    await expect(menu.getByRole('menuitem')).toHaveText(['Profilo', 'Impostazioni', 'Aiuto']);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(account).toBeFocused();
    await account.click();
    await menu.getByRole('menuitem', { name: 'Impostazioni', exact: true }).click();
    await expect(page).toHaveURL('/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Impostazioni' })).toBeVisible();
    const dark = page.getByRole('radio', { name: /^Scuro/ });
    await dark.check();
    await expect(dark).toBeChecked();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Drawer mobile (Dialog Radix).
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Apri il menu di navigazione' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu di navigazione' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Refresh su un percorso profondo: i dati vengono riletti dal database.
    await page.goto('/settings');
    await expect(page.locator('dd', { hasText: 'Anteprima' })).toBeVisible();

    expect(await watch.collect()).toEqual([]);
  });

  test('M1: bacheca, colonne, schede, trascinamento, pannello di dettaglio e conferme sotto la CSP reale', async ({
    page,
  }) => {
    const watch = await watchViolations(page);
    await page.goto('/boards');
    await page.getByRole('button', { name: 'Crea la tua prima bacheca' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuova bacheca' });
    await dialog.getByLabel('Nome', { exact: true }).fill('Anteprima Kanban');
    await dialog.getByRole('radio', { name: /Minimal/ }).check({ force: true });
    await dialog.getByRole('button', { name: 'Crea bacheca' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Anteprima Kanban' })).toBeVisible();

    const col = (name: string) =>
      page.getByRole('region', { name, exact: true }).and(page.locator('[data-column-id]'));
    for (const title of ['Uno', 'Due']) {
      const first = col('Da fare');
      if (!(await first.getByLabel(/Titolo della nuova scheda/).isVisible()))
        await first.getByRole('button', { name: /Aggiungi scheda/ }).click();
      await first.getByLabel(/Titolo della nuova scheda/).fill(title);
      await page.keyboard.press('Enter');
      await expect(first.getByRole('link', { name: title })).toBeVisible();
    }

    // Trascinamento con il mouse (dnd-kit applica stili inline: la CSP deve consentirli).
    const from = (await page.locator('[data-card-id]').filter({ hasText: 'Due' }).boundingBox())!;
    const to = (await col('In corso').boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 10, from.y + 10, { steps: 4 });
    await page.mouse.move(to.x + to.width / 2, to.y + 90, { steps: 12 });
    await page.mouse.up();
    await expect(col('In corso').getByRole('link', { name: 'Due' })).toBeVisible();

    // Pannello di dettaglio (Dialog Radix come drawer) e conferma di eliminazione (AlertDialog).
    await page.getByRole('link', { name: 'Uno', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Uno' });
    await panel.getByLabel('Azienda').fill('ACME');
    await panel.getByRole('button', { name: 'Salva', exact: true }).last().click();
    await expect(panel.getByRole('button', { name: 'Salva', exact: true }).last()).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Azioni della vista' }).click();
    await page.getByRole('menuitem', { name: 'Elimina bacheca…' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Annulla' }).click();

    expect(await watch.collect()).toEqual([]);
  });

  test('M2: dettagli, etichette, campi personalizzati, tabella e ricerca sotto la CSP reale', async ({
    page,
  }) => {
    const watch = await watchViolations(page);
    await page.goto('/boards');
    await page.getByRole('main').getByRole('link', { name: 'Anteprima Kanban' }).click();
    await page.getByRole('link', { name: 'Uno', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Uno' });

    // Dettagli professionali (sezioni comprimibili) e fase/esito.
    await openTab(panel, 'Dettagli');
    await panel.getByRole('button', { name: /Opportunità/ }).click();
    await panel.getByLabel('Sede').fill('Brescia');
    await panel.getByLabel('Modalità di lavoro').selectOption('hybrid');
    await panel.getByLabel('Minima').fill('1800');
    await panel.getByLabel('Valuta').fill('EUR');
    // Fase ed etichette stanno in Panoramica.
    await openTab(panel, 'Panoramica');
    await transitionPipeline(panel, 'advance', 'applied');
    // Etichetta creata al volo.
    await panel.getByRole('button', { name: 'Aggiungi etichetta' }).click();
    await panel.getByLabel('Nuova etichetta').fill('Interessante');
    await panel.getByRole('button', { name: 'Crea e assegna' }).click();
    await expect(
      panel.getByRole('list', { name: 'Etichette assegnate' }).getByText('Interessante'),
    ).toBeVisible();
    await panel.getByRole('button', { name: 'Salva', exact: true }).last().click();
    await expect(panel.getByRole('button', { name: 'Salva', exact: true }).last()).toBeDisabled();
    await page.keyboard.press('Escape');

    // Configuratore dei campi (modulo caricato a richiesta: stessi vincoli della CSP).
    await page.getByRole('button', { name: 'Azioni della vista' }).click();
    await page.getByRole('menuitem', { name: 'Campi personalizzati…' }).click();
    const fields = page.getByRole('dialog', { name: 'Campi personalizzati' });
    await fields.getByRole('button', { name: 'Aggiungi campo' }).click();
    const form = page.getByRole('dialog', { name: 'Nuovo campo' });
    await form.getByLabel('Nome del campo').fill('Reparto');
    await form.getByRole('button', { name: 'Crea campo' }).click();
    await expect(fields.getByText('Reparto', { exact: true })).toBeVisible();
    await fields.getByRole('button', { name: 'Chiudi' }).click();

    // Tabella (route caricata a richiesta), ricerca, ordinamento e dettaglio dalla tabella.
    await page
      .getByRole('navigation', { name: 'Visualizzazione della bacheca' })
      .getByRole('link', { name: 'Tabella' })
      .click();
    await expect(page.getByRole('status').filter({ hasText: /risultat/ })).toHaveText(
      '2 risultati',
    );
    await page.getByRole('searchbox', { name: 'Cerca in questa bacheca' }).fill('brescia');
    await expect(page.getByRole('status').filter({ hasText: /risultat/ })).toHaveText(
      '1 risultato',
    );
    await page
      .getByRole('columnheader', { name: /Opportunità/ })
      .getByRole('button')
      .click();
    await expect(page.getByRole('columnheader', { name: /Opportunità/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await page.getByRole('link', { name: 'Uno', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Uno' }).getByLabel('Fase')).toHaveValue(
      'Inviata',
    );
    await page.keyboard.press('Escape');

    // Schermata Opportunità e vista compatta da telefono.
    await page.goto('/opportunities?q=brescia');
    await expect(page.getByRole('status').filter({ hasText: /risultat/ })).toHaveText(
      '1 risultato',
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole('list', { name: 'Opportunità' }).getByRole('link', { name: 'Uno' }),
    ).toBeVisible();

    expect(await watch.collect()).toEqual([]);
  });

  test('M2.5: modale ampia, schede, colloqui, guardia delle modifiche e card Kanban sotto la CSP reale', async ({
    page,
  }) => {
    const watch = await watchViolations(page);
    await page.setViewportSize({ width: 1360, height: 800 });
    await page.goto('/boards');
    await page.getByRole('main').getByRole('link', { name: 'Anteprima Kanban' }).click();
    await page.getByRole('link', { name: 'Uno', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Uno' });
    const box = (await panel.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(1000.5);

    // L'URL cambia prima che il pannello sia attivo: si attende la selezione ARIA, altrimenti il
    // locator può agganciarsi al pulsante omonimo della Panoramica, ormai nascosto (CI 42334739111).
    await openTab(panel, 'Colloqui');
    await expect(page).toHaveURL(/#colloqui$/);
    await panel.getByRole('button', { name: 'Aggiungi colloquio' }).click();
    const form = panel
      .locator('form')
      .filter({ has: page.getByRole('heading', { name: 'Nuovo colloquio' }) });
    await form.getByLabel('Data e ora').fill('2027-05-04T10:00');
    await form.getByRole('button', { name: 'Aggiungi colloquio' }).click();
    await expect(panel.getByRole('article', { name: /^Round 1:/ })).toContainText('Programmato');

    // Guardia delle modifiche non salvate (AlertDialog annidato) e chiusura.
    await openTab(panel, 'Panoramica');
    await panel.getByLabel('Azienda o ente').fill('Bozza');
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('alertdialog', { name: 'Hai modifiche non salvate' }),
    ).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Esci senza salvare' }).click();
    await expect(panel).toBeHidden();

    // La card mostra il prossimo colloquio; densità compatta (preferenza locale).
    const card = page
      .locator('[data-card-id]')
      .filter({ has: page.getByRole('link', { name: 'Uno', exact: true }) });
    await expect(card.getByText(/4 mag/)).toBeVisible();
    await page
      .getByRole('group', { name: 'Densità delle schede' })
      .getByRole('button', { name: 'Compatta' })
      .click();
    await expect(card.getByText(/4 mag/)).toBeVisible();

    // Telefono: schermo intero.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('link', { name: 'Uno', exact: true }).click();
    const mobile = (await page.getByRole('dialog', { name: 'Uno' }).boundingBox())!;
    expect(mobile.width).toBeGreaterThanOrEqual(388);

    expect(await watch.collect()).toEqual([]);
  });

  test('le risposte API del Worker non hanno CORS e rifiutano richieste cross-site', async ({
    request,
    baseURL,
  }) => {
    const bad = await request.post('/api/v1/workspaces', {
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      data: { name: 'x' },
    });
    expect(bad.status()).toBe(403);
    const ok = await request.get('/api/v1/me', { headers: { origin: baseURL! } });
    expect(Object.keys(ok.headers()).filter((h) => h.startsWith('access-control-'))).toEqual([]);
  });
});

test('M3.UI.1: ricerca globale e menu nella build con CSP reale', async ({ page }) => {
  const watch = await watchViolations(page);
  await page.goto('/');
  const search = page.getByRole('button', { name: 'Cerca in Jobward' });
  await expect(search).toBeVisible();
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox', { name: 'Cerca in Jobward' });
  await expect(input).toBeFocused();
  await input.fill('ACME');
  await expect(page.getByRole('group', { name: 'Opportunità', exact: true })).toBeVisible();
  await input.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Uno' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Azioni della vista' }).click();
  await expect(page.getByRole('menuitem', { name: 'Nuova scheda' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('banner')).toHaveCount(0);
  expect(await watch.collect()).toEqual([]);
});

test('M3-C3: pipeline, note, documenti e timeline lazy nella build con CSP reale', async ({
  page,
}) => {
  const watch = await watchViolations(page);
  await page.goto('/boards');
  await page.getByRole('main').getByRole('link', { name: 'Anteprima Kanban' }).click();
  await page.getByRole('link', { name: 'Uno', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Uno' });
  await transitionPipeline(panel, 'advance', 'interviewing');
  await openTab(panel, 'Note');
  await panel.getByRole('button', { name: 'Aggiungi nota' }).click();
  await panel.getByLabel('Testo della nota').fill('Nota sotto CSP');
  await panel.getByRole('button', { name: 'Salva nota' }).click();
  await expect(panel.getByText('Nota sotto CSP', { exact: true })).toBeVisible();
  await openTab(panel, 'Documenti');
  await panel.getByRole('button', { name: 'Aggiungi riferimento' }).click();
  await panel.getByLabel('Titolo del documento').fill('CV sotto CSP');
  await panel.getByLabel('URL (facoltativo)').fill('https://example.com/cv');
  await panel.getByRole('button', { name: 'Salva riferimento' }).click();
  await expect(panel.getByRole('link', { name: /Apri documento/ })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  );
  await transitionPipeline(panel, 'close', 'rejected');
  await transitionPipeline(panel, 'reopen', 'interviewing');
  await openTab(panel, 'Timeline');
  await expect(
    panel
      .getByRole('tabpanel', { name: 'Timeline', exact: true })
      .getByText('Nota sotto CSP', { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText('Candidatura riaperta')).toBeVisible();
  await page.reload();
  await expect(panel.getByRole('tab', { name: 'Timeline', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(await watch.collect()).toEqual([]);
});

test('M3 Tasks: pagina, dialog, sezione nella candidatura e Timeline nella build con CSP reale', async ({
  page,
}) => {
  const watch = await watchViolations(page);
  await page.goto('/tasks');
  await expect(page.getByRole('heading', { level: 1, name: 'Attività' })).toBeVisible();
  await page.getByRole('button', { name: 'Nuova attività' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nuova attività' });
  await dialog.getByLabel('Titolo').fill('Attività sotto CSP');
  await dialog.getByRole('button', { name: 'Domani' }).click();
  await dialog.getByRole('button', { name: 'Crea attività' }).click();
  await expect(dialog).toBeHidden();
  const row = page.locator('[data-task-row]').filter({ hasText: 'Attività sotto CSP' });
  await expect(row).toBeVisible();
  await page.getByRole('button', { name: 'Da fare', exact: true }).click();
  await expect(page).toHaveURL(/vista=da-fare/);
  await row.getByRole('button', { name: 'Segna come completata: Attività sotto CSP' }).click();
  await expect(row).toHaveCount(0);

  // Sezione nella candidatura (modale + dialog annidato) e voce derivata nella Timeline.
  await page.goto('/boards');
  await page.getByRole('main').getByRole('link', { name: 'Anteprima Kanban' }).click();
  await page.getByRole('link', { name: 'Uno', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Uno' });
  const section = panel.getByRole('region', { name: 'Attività della candidatura' });
  await section.getByRole('button', { name: 'Aggiungi attività' }).click();
  const nested = page.getByRole('dialog', { name: 'Nuova attività' });
  await expect(nested.getByTestId('task-linked-card')).toContainText('Uno');
  await nested.getByLabel('Titolo').fill('Legata sotto CSP');
  await nested.getByRole('button', { name: 'Crea attività' }).click();
  await expect(nested).toBeHidden();
  await expect(
    section.getByRole('button', { name: 'Legata sotto CSP', exact: true }),
  ).toBeVisible();
  await openTab(panel, 'Timeline');
  await expect(panel.getByText('Attività creata').first()).toBeVisible();
  expect(await watch.collect()).toEqual([]);
});
