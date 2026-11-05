import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

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
  page.on('requestfailed', (r) => issues.push(`requestfailed: ${r.url()}`));
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
    for (const link of ['Bacheche', 'Opportunità', 'Attività', 'Insights', 'Impostazioni']) {
      await nav.getByRole('link', { name: link }).click();
      await expect(page.getByRole('heading', { level: 1, name: link })).toBeVisible();
    }

    // Menu a comparsa (Radix: portali e stili inline) e cambio tema.
    await page.getByRole('button', { name: 'Menu account' }).click();
    await page.getByRole('menuitemradio', { name: 'Scuro' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.keyboard.press('Escape');

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
    await panel.getByRole('button', { name: 'Salva' }).click();
    await expect(panel.getByRole('button', { name: 'Salva' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Azioni bacheca' }).click();
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
    await panel.getByRole('tab', { name: 'Dettagli' }).click();
    await panel.getByRole('button', { name: /Opportunità/ }).click();
    await panel.getByLabel('Sede').fill('Brescia');
    await panel.getByLabel('Modalità di lavoro').selectOption('hybrid');
    await panel.getByLabel('Minima').fill('1800');
    await panel.getByLabel('Valuta').fill('EUR');
    await panel.getByLabel('Fase').selectOption('applied');
    // Etichetta creata al volo.
    await panel.getByRole('button', { name: 'Aggiungi etichetta' }).click();
    await panel.getByLabel('Nuova etichetta').fill('Interessante');
    await panel.getByRole('button', { name: 'Crea e assegna' }).click();
    await expect(
      panel.getByRole('list', { name: 'Etichette assegnate' }).getByText('Interessante'),
    ).toBeVisible();
    await panel.getByRole('button', { name: 'Salva' }).click();
    await expect(panel.getByRole('button', { name: 'Salva' })).toBeDisabled();
    await page.keyboard.press('Escape');

    // Configuratore dei campi (modulo caricato a richiesta: stessi vincoli della CSP).
    await page.getByRole('button', { name: 'Azioni bacheca' }).click();
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
      'applied',
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
