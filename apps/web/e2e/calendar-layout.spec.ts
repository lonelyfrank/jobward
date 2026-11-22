import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

const item = (
  id: number,
  date: string,
  kind: 'interview' | 'task' | 'deadline',
  title: string,
) => ({
  kind,
  id: `i${id}`,
  date,
  at: kind === 'interview' ? Date.parse(`${date}T09:30:00Z`) : null,
  title,
  status: null,
  cardId: `c${id}`,
  cardTitle: `Opportunità ${id} con un titolo piuttosto lungo`,
  boardId: 'b1',
});

// Un giorno affollato (9 eventi) e qualche giorno con uno o due eventi.
const items = [
  ...Array.from({ length: 9 }, (_, i) =>
    item(i, '2026-11-12', (['interview', 'task', 'deadline'] as const)[i % 3]!, `Evento ${i}`),
  ),
  item(20, '2026-11-03', 'interview', 'Primo colloquio tecnico'),
  item(21, '2026-11-18', 'task', 'Inviare il portfolio aggiornato'),
  item(22, '2026-11-18', 'deadline', 'Scadenza annuncio'),
];

async function mock(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('/me')
      ? {
          user: { id: 'u1', email: 'calendar@example.com' },
          workspaces: [
            { id: 'w1', name: 'Ricerca', timezone: 'Europe/Rome', role: 'owner', createdAt: 1 },
          ],
        }
      : path.endsWith('/calendar')
        ? { timeZone: 'Europe/Rome', items }
        : { boards: [] };
    await route.fulfill({ json });
  });
  await page.goto('/calendar?mese=2026-11');
  await expect(page.getByRole('heading', { name: 'novembre 2026' })).toBeVisible();
}

const pageScroll = (page: Page) =>
  page.locator('#main').evaluate((el) => el.scrollHeight - el.clientHeight);

for (const [width, height] of [
  [1024, 640],
  [1366, 768],
  [1920, 1080],
] as const) {
  test(`calendario ${width}×${height}: tutto il mese nella finestra, senza scroll né sovrapposizioni`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mock(page);
    const crowded = page.getByRole('listitem', { name: /12 novembre: 9 eventi/ });
    await expect(crowded.getByRole('button', { name: /tutti i 9 eventi/ })).toBeVisible();
    expect(await pageScroll(page)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    // Nessuna cella trabocca: il contenuto visibile resta entro i suoi bordi.
    const overflowing = await page
      .locator('ol > li[aria-label]')
      .evaluateAll(
        (cells) => cells.filter((cell) => cell.scrollHeight > cell.clientHeight + 1).length,
      );
    expect(overflowing).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('calendar.png') });

    await crowded.getByRole('button', { name: /tutti i 9 eventi/ }).click();
    const popover = page.getByRole('dialog', { name: /Eventi di giovedì 12 novembre/ });
    await expect(popover.getByRole('link')).toHaveCount(9);
    await expectNoA11yViolations(page, `Calendario ${width}`);
    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
  });
}

test('calendario telefono: agenda che scorre al suo interno, pagina ferma', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await mock(page);
  await expect(page.getByRole('heading', { name: /giovedì 12 novembre/i })).toBeVisible();
  expect(await pageScroll(page)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
