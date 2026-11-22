import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

// Many rows force each panel to scroll without modifying the local user's data.
const overview = {
  workspaceId: 'w1',
  counts: {
    boards: 40,
    opportunities: 40,
    applicationsSubmitted: 24,
    interviews: 5,
    openTasks: 40,
    overdueTasks: 0,
    dueTodayTasks: 0,
    noDueTasks: 0,
  },
  recentBoards: Array.from({ length: 40 }, (_, i) => ({
    id: `b${i}`,
    name: `Bacheca ${i + 1}`,
    color: null,
    icon: null,
    updatedAt: 1,
  })),
  recentCards: Array.from({ length: 40 }, (_, i) => ({
    id: `c${i}`,
    title: `Opportunità ${i + 1} — posizione professionale con un titolo lungo`,
    boardId: 'b0',
    boardName: 'Milano',
    columnName: 'Inviate',
    updatedAt: 1,
  })),
  upcomingTasks: Array.from({ length: 40 }, (_, i) => ({
    id: `t${i}`,
    title: `Preparare il colloquio ${i + 1}`,
    dueAt: 1,
    dueOn: '2026-11-30',
    cardId: null,
  })),
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('/me')
      ? {
          user: { id: 'u1', email: 'overview@example.com' },
          workspaces: [
            { id: 'w1', name: 'Ricerca', timezone: 'Europe/Rome', role: 'owner', createdAt: 1 },
          ],
        }
      : path.endsWith('/overview')
        ? overview
        : { boards: [] };
    await route.fulfill({ json });
  });
});

for (const size of [
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]) {
  test(`desktop ${size.width}: titoli fermi, scorrimento indipendente e Home interamente visibile`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(size);
    await page.emulateMedia({
      colorScheme: size.width === 1366 ? 'dark' : 'light',
      reducedMotion: 'reduce',
    });
    await page.goto('/');
    const frame = page.locator('.overview-page');
    await expect(page.getByTestId('stat-grid')).toBeVisible();
    await expect(frame.locator('.overview-section')).toHaveCount(3);
    expect(await frame.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    const first = frame.locator('.overview-recents > section').first();
    await expect(first).toHaveCSS('border-right-width', '1px');
    for (const section of await frame.locator('.overview-section').all()) {
      const title = section.getByRole('heading');
      const list = section.locator('.overview-section-content');
      const before = (await title.boundingBox())!;
      await expect(section).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      expect(await list.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);
      await list.focus();
      await page.keyboard.press('End');
      await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      expect((await title.boundingBox())!.y).toBe(before.y);
      expect(await frame.evaluate((el) => el.scrollTop)).toBe(0);
      expect(await page.getByRole('main').evaluate((el) => el.scrollTop)).toBe(0);
      await list.evaluate((el) => {
        el.scrollTop = 0;
      });
    }
    const deadline = (await frame.locator('#overview-upcoming').boundingBox())!;
    expect(deadline.y + deadline.height).toBeLessThan(size.height);
    await page.screenshot({ path: testInfo.outputPath('overview.png') });
    await expectNoA11yViolations(page, `Overview ${size.width}`);
  });
}

for (const size of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1366, height: 560 },
]) {
  test(`${size.width}x${size.height}: tutte le sezioni raggiungibili senza overflow orizzontale`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.getByTestId('stat-grid')).toBeVisible();
    for (const list of await page.locator('.overview-section-content').all()) {
      await list.scrollIntoViewIfNeeded();
      await expect(list).toBeInViewport();
      expect(await list.evaluate((el) => el.scrollHeight)).toBeGreaterThan(
        await list.evaluate((el) => el.clientHeight),
      );
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    expect(
      await page.locator('.overview-page').evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBe(0);
  });
}
