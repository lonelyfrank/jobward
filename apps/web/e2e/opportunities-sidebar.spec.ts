import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, smallTouchTargets } from './helpers';

const board = (id: string, name: string) => ({
  id,
  name,
  description: null,
  icon: null,
  color: null,
  position: 0,
  isFavorite: false,
  createdAt: 1,
  updatedAt: 1,
  columnCount: 1,
  cardCount: 1,
});
const boards = [board('b1', 'Milano'), board('b2', 'Altre opportunità')];
const item = {
  id: 'c1',
  boardId: 'b1',
  columnId: 'col-b1',
  title: 'Tecnico IT Junior — Help Desk e Infrastructure',
  seniority: null,
  deadlineOn: null,
  requirements: null,
  benefits: null,
  interest: null,
  companyId: null,
  applicationId: 'a1',
  applicationCount: 1,
  description: null,
  priority: 'high',
  position: 0,
  company: 'Azienda con una denominazione molto lunga',
  jobTitle: null,
  location: 'Milano',
  workMode: 'remote',
  contractType: null,
  salaryMin: null,
  salaryMax: null,
  currency: null,
  salaryPeriod: null,
  salaryBasis: null,
  source: null,
  sourceUrl: null,
  publishedOn: null,
  appliedOn: '2026-11-20',
  stage: 'applied',
  outcome: null,
  labelIds: [],
  interviewSummary: { total: 0, completed: 0, next: null, action: null },
  createdAt: 1,
  updatedAt: 1795320000000,
  archivedAt: null,
  boardName: 'Milano',
  columnName: 'Inviate',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path.endsWith('/me'))
      json = {
        user: { id: 'u1', email: 'sidebar@example.com' },
        workspaces: [
          {
            id: 'w1',
            name: 'Ricerca',
            timezone: 'Europe/Rome',
            role: 'owner',
            createdAt: 1,
          },
        ],
      };
    else if (path.endsWith('/overview'))
      json = {
        workspaceId: 'w1',
        counts: {
          boards: 2,
          opportunities: 1,
          applicationsSubmitted: 1,
          interviews: 0,
          openTasks: 0,
          overdueTasks: 0,
          dueTodayTasks: 0,
          noDueTasks: 0,
        },
        upcomingTasks: [],
        recentBoards: [],
        recentCards: [],
      };
    else if (path.endsWith('/boards')) json = { boards };
    else if (path.includes('/boards/')) {
      const selected = boards.find((b) => path.endsWith(b.id))!;
      json = {
        board: selected,
        cards: [],
        columns: [
          {
            id: `col-${selected.id}`,
            boardId: selected.id,
            name: 'Inviate',
            color: null,
            category: null,
            position: 0,
            cardCount: 1,
            archivedCount: 0,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      };
    } else if (path.endsWith('/views')) json = { views: [] };
    else if (path.endsWith('/labels')) json = { labels: [] };
    else if (path.endsWith('/opportunities'))
      json = { items: [item], total: 1, page: 1, pageSize: 25, pageCount: 1 };
    await route.fulfill({ json });
  });
});

for (const width of [320, 390, 768, 1024, 1366, 1920]) {
  test(`sidebar e colonne senza sovrapposizioni a ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: width === 1366 ? 'dark' : 'light' });
    await page.goto('/opportunities');
    const sidebar = page.getByRole('complementary', {
      name: 'Personalizza opportunità',
    });
    await expect(page.getByText('1 risultato', { exact: true })).toBeVisible();
    await sidebar.getByRole('button', { name: 'Colonne', exact: true }).click();
    for (const checkbox of await sidebar.getByRole('checkbox').all()) {
      if (await checkbox.isEnabled()) await checkbox.check();
    }
    await expect(
      sidebar.getByRole('checkbox', { name: 'Opportunità', exact: true }),
    ).toBeDisabled();
    const region = page.getByRole('region', {
      name: /Tabella delle opportunità/,
    });
    const assertLayout = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
      expect(await sidebar.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(
        1,
      );
      if (width >= 1024) {
        const a = (await sidebar.boundingBox())!;
        const b = (await region.boundingBox())!;
        const nav = (await page.locator('aside').first().boundingBox())!;
        expect(a.x - (nav.x + nav.width)).toBeGreaterThanOrEqual(12);
        expect(b.x - (a.x + a.width)).toBeGreaterThanOrEqual(16);
        expect(a.y + a.height).toBeLessThanOrEqual(880);
        expect(
          await sidebar.evaluate((el) => parseFloat(getComputedStyle(el).borderRadius)),
        ).toBeGreaterThan(0);
      }
      if (width >= 768) {
        expect(await region.evaluate((el) => el.scrollWidth)).toBeGreaterThan(
          await region.evaluate((el) => el.clientWidth),
        );
      }
    };
    await assertLayout();
    if (width >= 768) {
      const toggle = page.getByRole('button', {
        name: 'Comprimi la barra laterale',
      });
      await toggle.focus();
      await toggle.press('Enter');
      await expect(page.locator('aside').first()).toHaveCSS('width', '52px');
      await assertLayout();
    } else {
      expect(await smallTouchTargets(page, 'main')).toEqual([]);
    }
    if (width === 1366 || width === 390) {
      await page.screenshot({
        path: testInfo.outputPath(`opportunities-${width}.png`),
        fullPage: true,
      });
      await expectNoA11yViolations(page, `sidebar colonne ${width}px`);
    }
  });
}

test('bacheca, colonna e cronologia restano coerenti; le preferenze colonne sopravvivono al refresh', async ({
  page,
}) => {
  await page.goto('/opportunities?board=b1&column=col-b1&page=3');
  const sidebar = page.getByRole('complementary', {
    name: 'Personalizza opportunità',
  });
  await expect(sidebar.getByRole('combobox', { name: 'Colonna', exact: true })).toHaveValue(
    'col-b1',
  );
  await sidebar.getByRole('combobox', { name: 'Bacheca', exact: true }).selectOption('b2');
  await expect(page).toHaveURL(/board=b2/);
  await expect(page).not.toHaveURL(/column=|page=/);
  await expect(sidebar.getByRole('combobox', { name: 'Colonna', exact: true })).toHaveValue('');
  await page.goBack();
  await expect(sidebar.getByRole('combobox', { name: 'Bacheca', exact: true })).toHaveValue('b1');
  await expect(sidebar.getByRole('combobox', { name: 'Colonna', exact: true })).toHaveValue(
    'col-b1',
  );
  await sidebar.getByRole('button', { name: 'Colonne', exact: true }).click();
  await sidebar.getByRole('checkbox', { name: 'Azienda', exact: true }).uncheck();
  await sidebar.getByRole('checkbox', { name: 'Località', exact: true }).check();
  await expect(page.getByRole('columnheader', { name: /Azienda/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /Località/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('columnheader', { name: /Azienda/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /Località/ })).toBeVisible();
});
