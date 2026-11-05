import { expect, test, type Page } from '@playwright/test';
import { ensureWorkspace, expectNoA11yViolations, seedApi } from './helpers';

const PATHS = [
  '/',
  '/boards',
  '/opportunities',
  '/tasks',
  '/insights',
  '/settings',
  '/percorso-inesistente',
];
// 320 px = reflow WCAG 1.4.10 (equivalente a zoom 400% su una finestra di 1280 px).
const WIDTHS = [320, 390, 768, 1024, 1360] as const;
const DESKTOP_MIN = 768; // breakpoint `md` di Tailwind: da qui la sidebar è persistente

test.beforeEach(async ({ page }) => {
  await ensureWorkspace(page);
});

/** Elementi interattivi visibili che escono dal viewport o dall'area scrollabile orizzontale. */
async function offscreen(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const bad: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(
      'a[href],button,input,select,[role=radio]',
    )) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue;
      if (el.closest('[aria-hidden=true]') || el.matches('.sr-only')) continue;
      if (r.right > width + 1 || r.left < -1) {
        // Dentro un'area che scorre in orizzontale ed è essa stessa nel viewport l'elemento è
        // raggiungibile scorrendo (tabella a 768 px): non è un elemento perso fuori pagina.
        let scroller: HTMLElement | null = el.parentElement;
        let reachable = false;
        while (scroller && scroller !== document.body) {
          const overflowX = getComputedStyle(scroller).overflowX;
          const box = scroller.getBoundingClientRect();
          if (
            (overflowX === 'auto' || overflowX === 'scroll') &&
            scroller.scrollWidth > scroller.clientWidth &&
            box.left >= -1 &&
            box.right <= width + 1
          ) {
            reachable = true;
            break;
          }
          scroller = scroller.parentElement;
        }
        if (reachable) continue;
        bad.push(
          `${el.tagName} "${(el.textContent ?? '').trim().slice(0, 25)}" ${Math.round(r.left)}-${Math.round(r.right)}/${width}`,
        );
      }
    }
    return bad;
  });
}

test.describe('tabella con dati (regressione: flaky su CI, run 41960496233)', () => {
  // Il controllo «elementi fuori viewport» passava solo se la pagina era ancora in caricamento.
  // Con la tabella popolata le colonne oltre il bordo stanno nel suo contenitore a scorrimento
  // confinato (voluto): non sono "fuori viewport", sono raggiungibili scorrendo l'area.
  test("768px: con dati, le colonne fuori vista sono dentro un'area che scorre, non fuori pagina", async ({
    page,
  }) => {
    await ensureWorkspace(page);
    const api = await seedApi(page);
    const board = await api.board('Regressione tabella');
    await api.card(board.columns[0]!.id, 'Scheda per la tabella', { company: 'Azienda lunga' });
    await page.setViewportSize({ width: 768, height: 800 });
    await page.goto('/opportunities?q=tabella');
    await expect(page.getByRole('table')).toBeVisible(); // dati caricati, non lo scheletro
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(await offscreen(page)).toEqual([]);
    const region = page.getByRole('region', { name: /Tabella delle opportunità/ });
    const metrics = await region.evaluate((el) => ({ s: el.scrollWidth, c: el.clientWidth }));
    expect(metrics.s).toBeGreaterThan(metrics.c); // il caso che prima faceva fallire il controllo
  });
});

test.describe('responsive: 320 / 390 / 768 / 1024 / 1360 px', () => {
  for (const width of WIDTHS) {
    test(`${width}px: nessun overflow, layout corretto su ogni schermata`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const path of PATHS) {
        await page.goto(path);
        await expect(page.getByRole('main')).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `scroll orizzontale su ${path} a ${width}px`).toBeLessThanOrEqual(0);
        expect(await offscreen(page), `elementi fuori viewport su ${path} a ${width}px`).toEqual(
          [],
        );

        const sidebar = page.getByRole('navigation', { name: 'Navigazione principale' });
        const hamburger = page.getByRole('button', { name: 'Apri il menu di navigazione' });
        if (width >= DESKTOP_MIN) {
          await expect(sidebar, `sidebar visibile a ${width}px`).toBeVisible();
          await expect(hamburger).toBeHidden();
        } else {
          await expect(sidebar).toBeHidden();
          await expect(hamburger).toBeVisible();
        }
      }
    });
  }

  test('390px: i controlli interattivi hanno area di almeno 44×44 px (esclusi i link nel testo)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const small: string[] = [];
    for (const path of ['/', '/boards', '/settings']) {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      small.push(
        ...(await page.evaluate((p) => {
          const out: string[] = [];
          for (const el of document.querySelectorAll<HTMLElement>(
            'a[href],button,input:not([type=radio]),select,label:has(input[type=radio])',
          )) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || el.matches('.sr-only') || el.closest('p'))
              continue;
            if (el.matches('a.sr-only')) continue;
            if (r.height < 43.5 || r.width < 43.5)
              out.push(
                `${p} ${el.tagName} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 22)}" ${Math.round(r.width)}x${Math.round(r.height)}`,
              );
          }
          return out;
        }, path)),
      );
    }
    expect(small).toEqual([]);
  });

  for (const width of [768, 1024, 1360] as const) {
    test(`${width}px: le schede statistiche restano leggibili (icone non schiacciate, griglia senza orfani)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      const grid = page.getByTestId('stat-grid');
      await expect(grid).toBeVisible();
      const info = await grid.evaluate((el) => {
        const cards = [...el.children] as HTMLElement[];
        const icons = cards.map((c) => c.querySelector('svg')!.getBoundingClientRect().width);
        // Estensione orizzontale (bordo sinistro → destro) di ogni riga di schede.
        const rows = new Map<number, { left: number; right: number }>();
        for (const c of cards) {
          const r = c.getBoundingClientRect();
          const key = Math.round(r.top);
          const row = rows.get(key) ?? { left: Infinity, right: -Infinity };
          rows.set(key, { left: Math.min(row.left, r.left), right: Math.max(row.right, r.right) });
        }
        return { icons, rows: [...rows.values()].map((r) => Math.round(r.right - r.left)) };
      });
      expect(
        info.icons.every((w) => w >= 15.5),
        `icone: ${info.icons.join(',')}`,
      ).toBe(true);
      // Ogni riga occupa tutta la larghezza: nessuna scheda orfana che lascia un vuoto.
      expect(new Set(info.rows).size, `estensione delle righe: ${info.rows.join(',')}`).toBe(1);
    });
  }

  test('il drawer aperto si chiude se la finestra passa a desktop (nessun blocco invisibile)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Apri il menu di navigazione' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu di navigazione' })).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 800 });
    // Con il drawer "fantasma" la pagina sarebbe non cliccabile (pointer-events: none sul body).
    await page
      .getByRole('navigation', { name: 'Navigazione principale' })
      .getByRole('link', { name: 'Bacheche' })
      .click({ timeout: 3000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Bacheche' })).toBeVisible();
  });
});

test.describe('tastiera e focus', () => {
  test('il primo Tab porta allo skip link; Invio sposta il focus sul contenuto', async ({
    page,
  }) => {
    await page.goto('/boards');
    await expect(page.getByRole('heading', { level: 1, name: 'Bacheche' })).toBeVisible(); // pagina caricata
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Vai al contenuto' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
  });

  test('ogni controllo raggiungibile con Tab mostra un indicatore di focus visibile', async ({
    page,
  }) => {
    await page.goto('/settings');
    const seen = new Set<string>();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
        const label =
          el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 25) ?? el.tagName;
        return { label: `${el.tagName}:${label}`, outline, boxShadow: cs.boxShadow !== 'none' };
      });
      if (!info || seen.has(info.label)) continue;
      seen.add(info.label);
      expect(info.outline || info.boxShadow, `focus non visibile su ${info.label}`).toBe(true);
    }
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });

  test('menu account: si apre da tastiera, Esc lo chiude e il focus torna al pulsante', async ({
    page,
  }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Menu account' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();
    // Aperto da tastiera, il focus va subito sulla prima voce; le frecce scorrono le altre.
    const items = page.getByRole('menuitemradio');
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await expectNoA11yViolations(page, 'menu account aperto');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('drawer mobile: focus intrappolato, Esc chiude e il focus torna al pulsante', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const opener = page.getByRole('button', { name: 'Apri il menu di navigazione' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Menu di navigazione' });
    await expect(dialog).toBeVisible();
    await expectNoA11yViolations(page, 'drawer aperto');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(
        await dialog.evaluate((d) => d.contains(document.activeElement)),
        `focus uscito dal drawer al Tab ${i + 1}`,
      ).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('onboarding: un invio non valido porta il focus sul campo in errore', async ({ page }) => {
    // Pagina di onboarding simulata: /me senza workspace, solo per questo test.
    await page.route('**/api/v1/me', (route) =>
      route.fulfill({ json: { user: { id: 'u', email: 'x@example.com' }, workspaces: [] } }),
    );
    await page.goto('/');
    const name = page.getByLabel('Nome dello spazio');
    await name.fill('');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert').first()).toContainText('Campo obbligatorio');
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toHaveAccessibleDescription(/Campo obbligatorio/);
    await expectNoA11yViolations(page, 'onboarding con errore');
  });
});

test.describe('movimento ridotto', () => {
  test('con prefers-reduced-motion le animazioni e le transizioni sono neutralizzate', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Riepilogo' })).toBeVisible(); // pagina caricata
    const durations = await page.evaluate(() => {
      const pick = (sel: string) => {
        const cs = getComputedStyle(document.querySelector(sel)!);
        return { animation: cs.animationDuration, transition: cs.transitionDuration };
      };
      return { content: pick('main > div'), aside: pick('aside') };
    });
    for (const d of [durations.content.animation, durations.aside.transition]) {
      expect(parseFloat(d)).toBeLessThan(0.001); // secondi: 0.01ms
    }
  });
});

test.describe('richieste e stati di errore', () => {
  test('il caricamento dell’Overview non duplica le richieste', async ({ page }) => {
    const calls: string[] = [];
    page.on('request', (r) => {
      const p = new URL(r.url()).pathname;
      if (p.startsWith('/api/')) calls.push(p);
    });
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Riepilogo' })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Navigazione principale' })
      .getByRole('link', { name: 'Bacheche' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Bacheche' })).toBeVisible();
    expect(calls.filter((c) => c === '/api/v1/me')).toHaveLength(1);
    expect(calls.filter((c) => c === '/api/v1/overview')).toHaveLength(1);
  });

  test('errore del riepilogo: messaggio annunciato, accessibile e recuperabile con "Riprova"', async ({
    page,
  }) => {
    let fail = true;
    await page.route('**/api/v1/overview*', (route) =>
      fail
        ? route.fulfill({
            status: 500,
            json: { error: { code: 'internal_error', message: 'x', requestId: 'r' } },
          })
        : route.continue(),
    );
    await page.goto('/');
    const alert = page
      .getByRole('alert')
      .filter({ hasText: 'Non riusciamo a caricare il riepilogo' });
    await expect(alert).toBeVisible({ timeout: 15_000 }); // TanStack Query ritenta con backoff
    await expectNoA11yViolations(page, 'errore overview');
    fail = false;
    await page.getByRole('button', { name: 'Riprova' }).click();
    await expect(page.getByRole('region', { name: 'Riepilogo' })).toBeVisible();
  });

  test('accesso non autorizzato (401): schermata dedicata, senza shell, accessibile', async ({
    page,
  }) => {
    await page.route('**/api/v1/me', (route) =>
      route.fulfill({
        status: 401,
        json: { error: { code: 'unauthenticated', message: 'x', requestId: 'r' } },
      }),
    );
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Accesso non autorizzato' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navigazione principale' })).toHaveCount(0);
    await expectNoA11yViolations(page, 'accesso non autorizzato');
  });

  test('server irraggiungibile: messaggio con "Riprova", nessun dettaglio tecnico', async ({
    page,
  }) => {
    await page.route('**/api/v1/me', (route) => route.abort('failed'));
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Riprova' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(/TypeError|fetch|stack|ECONN/i);
  });
});
