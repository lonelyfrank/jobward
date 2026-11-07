import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, waitForAnimationsToSettle } from './helpers';

// I test sono sequenziali e condividono lo stesso D1 locale: il primo crea il workspace.
test.describe.configure({ mode: 'serial' });

const SECTIONS = [
  { link: 'Bacheche', heading: 'Bacheche', path: '/boards' },
  { link: 'Opportunità', heading: 'Opportunità', path: '/opportunities' },
  { link: 'Attività', heading: 'Attività', path: '/tasks' },
  { link: 'Insights', heading: 'Insights', path: '/insights' },
  { link: 'Impostazioni', heading: 'Impostazioni', path: '/settings' },
  { link: 'Profilo', heading: 'Profilo', path: '/profile' },
  { link: 'Aiuto', heading: 'Aiuto', path: '/help' },
] as const;

test('primo accesso: onboarding con validazione, poi creazione del workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Crea il tuo spazio di lavoro' })).toBeVisible();
  await expectNoA11yViolations(page, 'onboarding');

  const name = page.getByLabel('Nome dello spazio');
  await name.fill('');
  await page.getByRole('button', { name: 'Crea workspace' }).click();
  await expect(page.getByRole('alert')).toContainText('Campo obbligatorio');

  await name.fill('Ricerca autunno 2026');
  await page.getByRole('button', { name: 'Crea workspace' }).click();

  await expect(page.getByRole('navigation', { name: 'Navigazione principale' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inizia da qui' })).toBeVisible();
  await expect(page.getByText('“Ricerca autunno 2026”')).toBeVisible();
});

test('i dati persistono dopo il refresh: nessun nuovo onboarding, workspace letto dal database', async ({
  page,
}) => {
  await page.goto('/');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Crea il tuo spazio di lavoro' })).toHaveCount(0);
  await expect(page.getByText('“Ricerca autunno 2026”')).toBeVisible();

  const summary = page.getByRole('region', { name: 'Riepilogo' });
  await expect(summary.getByText('0', { exact: true })).toHaveCount(5);
});

test('naviga tra tutte le schermate e ciascuna dichiara cosa non è ancora disponibile', async ({
  page,
}) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navigazione principale' });
  for (const section of SECTIONS) {
    if (['Impostazioni', 'Profilo', 'Aiuto'].includes(section.link)) {
      await nav.getByRole('button', { name: /^Menu account/ }).click();
      await page.getByRole('menuitem', { name: section.link }).click();
    } else {
      await nav.getByRole('link', { name: section.link }).click();
    }
    await expect(page).toHaveURL(section.path);
    await expect(page.getByRole('heading', { level: 1, name: section.heading })).toBeVisible();
    await expect(page.getByRole('main')).toBeFocused();
  }
  // Un URL diretto (SPA fallback) deve funzionare anche dopo un refresh.
  await page.goto('/boards');
  await expect(page.getByRole('heading', { level: 1, name: 'Bacheche' })).toBeVisible();
  await page.getByRole('button', { name: 'Azioni della vista' }).click();
  await expect(page.getByRole('menuitem', { name: 'Nuova bacheca' })).toBeEnabled();
});

test('accessibilità WCAG 2.2 AA (automatica) su ogni schermata, tema chiaro e scuro', async ({
  page,
}) => {
  // Dodici analisi axe in sequenza (6 schermate × 2 temi): già vicine al limite predefinito
  // (19–30 s su un portatile con 4 core) e in crescita a ogni schermata nuova.
  test.slow();
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    // localStorage è accessibile solo su una pagina reale, non su about:blank.
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    for (const path of ['/', ...SECTIONS.map((s) => s.path)]) {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.locator('html')).toHaveClass(scheme === 'dark' ? /dark/ : /^(?!.*dark).*$/);
      await expectNoA11yViolations(page, `${path} (${scheme})`);
    }
  }
});

test('il tema scelto in Impostazioni viene applicato e ricordato dopo il refresh', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/settings');
  await page.getByRole('radio', { name: /Scuro/ }).check();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('radio', { name: /Scuro/ })).toBeChecked();

  await page.getByRole('radio', { name: /Chiaro/ }).check();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('la sidebar si comprime e la scelta resta dopo il refresh', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('aside')).toHaveCSS('width', '220px');
  await page.mouse.move(221, 350);
  await page.getByRole('button', { name: 'Comprimi la barra laterale' }).click();
  await page.reload();
  await expect(page.locator('aside')).toHaveCSS('width', '60px');
  await page.mouse.move(73, 350);
  await expect(page.getByRole('button', { name: 'Espandi la barra laterale' })).toBeVisible();
  await page.getByRole('button', { name: 'Espandi la barra laterale' }).click();
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('menu a comparsa, navigazione senza hover e nessuno scroll orizzontale', async ({
    page,
  }) => {
    await page.goto('/');
    // La sidebar fissa non c'è: si apre il drawer.
    await expect(page.getByRole('button', { name: 'Comprimi la barra laterale' })).toBeHidden();
    await page.getByRole('button', { name: 'Apri il menu di navigazione' }).click();

    const dialog = page.getByRole('dialog', { name: 'Menu di navigazione' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('link', { name: 'Bacheche' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: 'Bacheche' })).toBeVisible();

    for (const path of ['/', '/boards', '/settings']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `scroll orizzontale su ${path}`).toBeLessThanOrEqual(0);
    }
  });

  test('i controlli interattivi hanno un’area touch di almeno 44px', async ({ page }) => {
    await page.goto('/settings');
    await waitForAnimationsToSettle(page);
    const menu = await page
      .getByRole('button', { name: 'Apri il menu di navigazione' })
      .boundingBox();
    // La traslazione d'ingresso può produrre 43.999996 px per un target CSS da 44 px.
    expect(Math.round(menu?.width ?? 0)).toBeGreaterThanOrEqual(44);
    expect(Math.round(menu?.height ?? 0)).toBeGreaterThanOrEqual(44);
  });
});

test.describe('protezioni dell’API viste dal browser', () => {
  test('la health è pubblica, le altre rotte rispondono con errori standardizzati', async ({
    request,
  }) => {
    expect((await request.get('/api/health')).status()).toBe(200);

    const unknown = await request.get('/api/v1/non-esiste');
    expect(unknown.status()).toBe(404);
    expect((await unknown.json()).error.code).toBe('not_found');
    expect(unknown.headers()['cache-control']).toBe('no-store');
  });

  test('una richiesta cross-site che modifica dati viene rifiutata', async ({ request }) => {
    const res = await request.post('/api/v1/workspaces', {
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      data: { name: 'Intruso' },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).error.code).toBe('csrf_rejected');

    const form = await request.post('/api/v1/workspaces', {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: 'name=Intruso',
    });
    expect(form.status()).toBe(415);
  });

  test('il limite di un solo workspace è applicato dal server', async ({ request }) => {
    const res = await request.post('/api/v1/workspaces', { data: { name: 'Secondo' } });
    expect(res.status()).toBe(409);
  });
});
