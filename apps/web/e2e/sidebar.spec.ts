import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

test.beforeEach(async ({ page }) => {
  // Dati isolati: questi test verificano il layout senza dipendere dall'onboarding.
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('/me')
      ? {
          user: { id: 'u1', email: 'sidebar@example.com' },
          workspaces: [
            {
              id: 'w1',
              name: 'Ricerca sidebar',
              timezone: 'Europe/Rome',
              role: 'owner',
              createdAt: 1,
            },
          ],
        }
      : path.endsWith('/overview')
        ? {
            workspaceId: 'w1',
            counts: {
              boards: 0,
              opportunities: 0,
              applicationsSubmitted: 0,
              interviews: 0,
              openTasks: 0,
              overdueTasks: 0,
              dueTodayTasks: 0,
              noDueTasks: 0,
            },
            upcomingTasks: [],
            recentBoards: [],
            recentCards: [],
          }
        : { boards: [] };
    await route.fulfill({ json });
  });
});

test('bulge: compare vicino al bordo, segue il cursore, scompare e alterna sidebar espansa e fluttuante', async ({
  page,
}) => {
  await page.goto('/');
  const sidebar = page.locator('aside');
  const toggle = sidebar.getByRole('button', { name: 'Comprimi la barra laterale' });
  await expect(sidebar).toHaveCSS('width', '220px');
  await expect(toggle).toHaveCSS('opacity', '0');

  await page.mouse.move(221, 350);
  await expect
    .poll(async () => Number(await toggle.evaluate((el) => getComputedStyle(el).opacity)))
    .toBeGreaterThan(0.8);
  await expect
    .poll(async () => {
      const box = (await toggle.boundingBox())!;
      return Math.abs(box.y + box.height / 2 - 350);
    })
    .toBeLessThan(2);
  await page.mouse.move(221, 560);
  await expect
    .poll(async () => {
      const box = (await toggle.boundingBox())!;
      return Math.abs(box.y + box.height / 2 - 560);
    })
    .toBeLessThan(2);

  await page.mouse.move(500, 560);
  await expect(toggle).toHaveCSS('opacity', '0');
  await expect(toggle).toHaveCSS('pointer-events', 'none');
  await page.mouse.move(221, 350);
  await toggle.click();
  await expect(sidebar).toHaveCSS('width', '52px');
  const active = sidebar.getByRole('link', { name: 'Overview', exact: true });
  await expect(active).toHaveCSS('width', '44px');
  await expect(active).toHaveCSS('height', '44px');
  await expect(sidebar).toHaveCSS('margin-left', '12px');
  await expect(sidebar).toHaveCSS('margin-top', '12px');
  await expect(sidebar).toHaveCSS('margin-bottom', '12px');
  await expect(sidebar).toHaveCSS('border-radius', '20px');
  await expect(sidebar.getByRole('button', { name: /^Menu account/ })).toHaveCSS('width', '44px');
  await expect(sidebar.getByRole('button', { name: /^Menu account/ })).toHaveCSS('height', '44px');
  await expect(active).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  // La larghezza della barra e l'altezza del link devono scalare insieme al testo.
  await page.evaluate(() => (document.documentElement.style.fontSize = '18px'));
  await expect(sidebar).toHaveCSS('width', '58.5px');
  await expect(active).toHaveCSS('width', '49.5px');
  await expect(active).toHaveCSS('height', '49.5px');
  await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
  await expect(sidebar).toHaveCSS('width', '52px');
  await expect(sidebar.getByRole('heading', { name: 'Bacheche recenti' })).toHaveCount(0);
  const boards = sidebar.getByRole('link', { name: 'Bacheche', exact: true });
  await boards.hover();
  await expect(page.getByRole('tooltip')).toContainText('Bacheche');
  await page.mouse.move(500, 350);
  const expand = sidebar.getByRole('button', { name: 'Espandi la barra laterale' });
  await expect(expand).toHaveCSS('opacity', '0');
  await page.reload();
  await expect(sidebar).toHaveCSS('width', '52px');
  await page.mouse.move(73, 350);
  await expand.click();
  await expect(sidebar).toHaveCSS('width', '220px');
  await expect(sidebar).toHaveCSS('margin-left', '0px');
  await expect(sidebar).toHaveCSS('margin-top', '0px');
  await expect(sidebar).toHaveCSS('margin-bottom', '0px');
  await expect(sidebar).toHaveCSS('border-radius', '0px');
  await expect(sidebar.getByRole('heading', { name: 'Bacheche recenti' })).toBeVisible();
});

test('collapse da tastiera e accessibilità nei due temi con movimento ridotto', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const sidebar = page.locator('aside');
  const toggle = sidebar.getByRole('button', { name: /(?:Comprimi|Espandi) la barra laterale/ });
  await sidebar.getByRole('button', { name: /^Menu account/ }).focus();
  await expect(sidebar.getByRole('button', { name: /^Menu account/ })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveCSS('opacity', '1');
  await page.keyboard.press('Enter');
  await expect(sidebar).toHaveCSS('width', '52px');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(sidebar.getByRole('link', { name: 'Bacheche', exact: true })).toBeVisible();
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await expectNoA11yViolations(page, `sidebar compressa (${colorScheme})`);
  }
  await page.keyboard.press('Space');
  await expect(sidebar).toHaveCSS('width', '220px');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
});

for (const layout of ['espansa', 'compressa', 'mobile'] as const) {
  test(`menu account: impostazioni, chiusura e navigazione con sidebar ${layout}`, async ({
    page,
  }) => {
    if (layout === 'mobile') {
      await page.setViewportSize({ width: 390, height: 844 });
    } else if (layout === 'compressa') {
      await page.addInitScript(() => localStorage.setItem('jobward-sidebar-collapsed', '1'));
    }
    await page.goto('/');
    if (layout === 'mobile') {
      await page.getByRole('button', { name: 'Apri il menu di navigazione' }).click();
    }
    const account = page.getByRole('button', { name: /^Menu account/ });
    await expect(page.getByRole('link', { name: 'Impostazioni', exact: true })).toHaveCount(0);
    await account.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu', { name: 'Menu account' });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('data-side', layout === 'compressa' ? 'right' : 'top');
    await expect(menu).toContainText('sidebar@example.com');
    await expect(menu.getByRole('menuitemradio')).toHaveCount(0);
    await expect(menu.getByRole('menuitem')).toHaveText(['Profilo', 'Impostazioni', 'Aiuto']);
    const box = (await menu.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(account).toBeFocused();
    if (layout === 'mobile') {
      await expect(page.getByRole('dialog', { name: 'Menu di navigazione' })).toBeVisible();
    }
    for (const [label, path] of [
      ['Impostazioni', '/settings'],
      ['Profilo', '/profile'],
      ['Aiuto', '/help'],
    ] as const) {
      if (layout === 'mobile' && path !== '/settings') {
        await page.getByRole('button', { name: 'Apri il menu di navigazione' }).click();
      }
      await account.click();
      await menu.getByRole('menuitem', { name: label }).click();
      await expect(page).toHaveURL(path);
      await expect(page.getByRole('heading', { name: label, level: 1 })).toBeVisible();
      await expect(menu).toBeHidden();
      if (layout === 'mobile') {
        await expect(page.getByRole('dialog', { name: 'Menu di navigazione' })).toBeHidden();
      } else {
        await expect(page.getByRole('main')).toBeFocused();
      }
    }
  });
}

test('menu account, profilo e aiuto sono accessibili nei due temi', async ({ page }) => {
  test.slow();
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await page.getByRole('button', { name: /^Menu account/ }).click();
    await expect(page.getByRole('menu', { name: 'Menu account' })).toBeVisible();
    await expectNoA11yViolations(page, `menu account (${colorScheme})`);
    for (const path of ['/profile', '/help']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoA11yViolations(page, `${path} (${colorScheme})`);
    }
  }
});

test('mobile: drawer indipendente dal collapse desktop e nessun bulge', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('jobward-sidebar-collapsed', '1'));
  await page.goto('/');
  await expect(page.getByTestId('sidebar-bulge')).toBeHidden();
  await page.getByRole('button', { name: 'Apri il menu di navigazione' }).click();
  const drawer = page.getByRole('dialog', { name: 'Menu di navigazione' });
  await expect(drawer.getByRole('heading', { name: 'Bacheche recenti' })).toBeVisible();
  await drawer.getByRole('link', { name: 'Bacheche', exact: true }).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Bacheche', level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('aside')).toHaveCSS('width', '52px');
});
