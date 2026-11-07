import { expect, test, type Page } from '@playwright/test';
import {
  cardItem,
  column,
  dragWithMouse,
  ensureWorkspace,
  expectNoA11yViolations,
  seedApi,
  titlesIn,
} from './helpers';

let boardId: string;

test.beforeEach(async ({ page }) => {
  await ensureWorkspace(page);
  const api = await seedApi(page);
  const board = await api.board('Bacheca zoom');
  boardId = board.id;
  await api.card(board.columns[0]!.id, 'Prima scheda');
  await api.card(board.columns[0]!.id, 'Seconda scheda');
  for (let index = 4; index <= 8; index++) {
    const result = await page.request.post(
      `/api/v1/boards/${boardId}/columns?workspaceId=${api.workspaceId}`,
      {
        data: { name: `Colonna ${index}` },
      },
    );
    expect(result.ok(), await result.text()).toBe(true);
  }
  await page.goto(`/boards/${boardId}`);
  await expect(page.locator('[data-column-id]')).toHaveCount(8);
  await openZoom(page);
});

const controls = (page: Page) => page.getByRole('group', { name: 'Zoom della bacheca' });
const launcher = (page: Page) =>
  controls(page).getByRole('button', { name: 'Controlli zoom e vista' });
async function openZoom(page: Page) {
  await launcher(page).hover();
  await expect(launcher(page)).toHaveAttribute('aria-expanded', 'true');
}
const reset = (page: Page) => controls(page).getByRole('button', { name: /Ripristina lo zoom/ });
const firstWidth = (page: Page) =>
  page
    .locator('[data-column-id]')
    .first()
    .evaluate((el) => el.getBoundingClientRect().width);

async function expectAllColumnsVisible(page: Page) {
  await expect
    .poll(async () =>
      page.getByTestId('kanban').evaluate((canvas) => {
        const bounds = canvas.parentElement!.getBoundingClientRect();
        return [...canvas.querySelectorAll('[data-column-id]')].every((column) => {
          const box = column.getBoundingClientRect();
          return box.left >= bounds.left - 1 && box.right <= bounds.right + 1;
        });
      }),
    )
    .toBe(true);
}

test('zoom modifica le colonne, resta locale alla bacheca e ritorna al 100%', async ({ page }) => {
  await expect(controls(page).getByRole('status')).toHaveText('100%');
  await expect.poll(() => firstWidth(page)).toBeCloseTo(288, 0);
  const toolbarWidth = (await controls(page).boundingBox())!.width;
  await controls(page).getByRole('button', { name: 'Riduci lo zoom' }).click();
  await expect(controls(page).getByRole('status')).toHaveText('90%');
  await expect.poll(() => firstWidth(page)).toBeCloseTo(259.2, 0);
  const canvas = page.getByTestId('kanban');
  await expect
    .poll(() =>
      canvas.evaluate((el) =>
        Math.abs(
          el.getBoundingClientRect().width - el.parentElement!.getBoundingClientRect().width,
        ),
      ),
    )
    .toBeLessThan(2);
  await canvas.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await expect
    .poll(() =>
      canvas.evaluate(
        (el) =>
          el.querySelector('[data-column-id]:last-child')!.getBoundingClientRect().right -
          el.parentElement!.getBoundingClientRect().right,
      ),
    )
    .toBeLessThanOrEqual(1);
  await canvas.evaluate((el) => {
    el.scrollLeft = 0;
  });
  expect((await controls(page).boundingBox())!.width).toBe(toolbarWidth);
  await controls(page).getByRole('button', { name: 'Aumenta lo zoom' }).click();
  await controls(page).getByRole('button', { name: 'Aumenta lo zoom' }).click();
  await expect(controls(page).getByRole('status')).toHaveText('110%');
  await page.reload();
  await openZoom(page);
  await expect(controls(page).getByRole('status')).toHaveText('110%');
  const api = await seedApi(page);
  const other = await api.board('Altra bacheca zoom');
  await page.goto(`/boards/${other.id}`);
  await openZoom(page);
  await expect(controls(page).getByRole('status')).toHaveText('100%');
  await page.goto(`/boards/${boardId}`);
  await openZoom(page);
  await expect(controls(page).getByRole('status')).toHaveText('110%');
  await reset(page).click();
  await expect.poll(() => firstWidth(page)).toBeCloseTo(288, 0);
});

test('mostra tutte le colonne e si adatta al cambio di finestra e sidebar', async ({ page }) => {
  await controls(page).getByRole('button', { name: 'Mostra tutte le colonne' }).click();
  await expectAllColumnsVisible(page);
  await page.getByRole('button', { name: 'Comprimi la barra laterale' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('aside')).toHaveCSS('width', '60px');
  await expectAllColumnsVisible(page);
  await page.setViewportSize({ width: 900, height: 700 });
  await expectAllColumnsVisible(page);
  await page.reload();
  await openZoom(page);
  await expect(
    controls(page).getByRole('button', { name: 'Mostra tutte le colonne' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expectAllColumnsVisible(page);
  await reset(page).click();
  await expect(controls(page).getByRole('status')).toHaveText('100%');
});

test('mobile: vista completa e comandi non ridotti, senza allargare la pagina', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openZoom(page);
  await controls(page).getByRole('button', { name: 'Mostra tutte le colonne' }).click();
  await expectAllColumnsVisible(page);
  for (const button of await controls(page).getByRole('button').all()) {
    const box = (await button.boundingBox())!;
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  const box = (await controls(page).boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await reset(page).click();
  await expect(controls(page).getByRole('status')).toHaveText('100%');
});

test('mouse: trascina schede e colonne con zoom al 75% e conserva gli spostamenti', async ({
  page,
}) => {
  for (let index = 0; index < 2; index++)
    await controls(page).getByRole('button', { name: 'Riduci lo zoom' }).click();
  await expect(controls(page).getByRole('status')).toHaveText('75%');
  await dragWithMouse(page, cardItem(page, 'Prima scheda'), column(page, 'In corso'));
  await expect.poll(() => titlesIn(page, 'In corso')).toEqual(['Prima scheda']);
  await dragWithMouse(
    page,
    page.getByRole('button', { name: 'Sposta la colonna “Completate”' }),
    page.getByRole('button', { name: 'Sposta la colonna “Da fare”' }),
  );
  await expect(page.locator('[data-column-id] h3').first()).toHaveText('Completate');
  await page.reload();
  await expect.poll(() => titlesIn(page, 'In corso')).toEqual(['Prima scheda']);
  await expect(page.locator('[data-column-id] h3').first()).toHaveText('Completate');
});

test('tastiera: riordina schede con zoom ridotto e menu restano raggiungibili', async ({
  page,
}) => {
  for (let index = 0; index < 2; index++)
    await controls(page).getByRole('button', { name: 'Riduci lo zoom' }).click();
  const handle = page.getByRole('button', {
    name: 'Sposta la scheda “Seconda scheda” con la tastiera',
  });
  await handle.focus();
  await page.keyboard.press('Space');
  await expect(page.getByText(/Hai preso “Seconda scheda”/)).toBeAttached();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByText(/“Seconda scheda” è ora sopra “Prima scheda”/)).toBeAttached();
  await page.keyboard.press('Space');
  await expect.poll(() => titlesIn(page, 'Da fare')).toEqual(['Seconda scheda', 'Prima scheda']);
  await page.getByRole('button', { name: 'Azioni per la colonna “Da fare”' }).click();
  await expect(page.getByRole('menuitem', { name: 'Modifica…' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expectNoA11yViolations(page, 'zoom Kanban 75%');
});

test('zoom flottante: nessun footer, apertura hover, chiusura al mouseout e accesso da tastiera', async ({
  page,
}) => {
  const canvas = page.getByTestId('kanban');
  await expect
    .poll(() =>
      canvas.evaluate((el) =>
        Math.abs(
          el.getBoundingClientRect().height - el.parentElement!.getBoundingClientRect().height,
        ),
      ),
    )
    .toBeLessThan(2);
  await page.mouse.move(500, 20);
  await expect(launcher(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(controls(page).getByRole('button', { name: 'Riduci lo zoom' })).toHaveCount(0);
  await expect.poll(async () => (await controls(page).boundingBox())!.width).toBeLessThan(60);
  await openZoom(page);
  await expect(controls(page).getByRole('button', { name: 'Riduci lo zoom' })).toBeVisible();
  await expect.poll(async () => (await controls(page).boundingBox())!.width).toBeGreaterThan(200);
  await controls(page).getByRole('button', { name: 'Riduci lo zoom' }).click();
  await page.mouse.move(500, 20);
  await expect(launcher(page)).toHaveAttribute('aria-expanded', 'false');
  await page
    .locator('[data-column-id]')
    .last()
    .getByRole('button', { name: /Aggiungi scheda/ })
    .focus();
  await page.keyboard.press('Tab');
  await expect(launcher(page)).toBeFocused();
  await expect(launcher(page)).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Shift+Tab');
  await expect(
    controls(page).getByRole('button', { name: 'Mostra tutte le colonne' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(launcher(page)).toBeFocused();
  await expect(launcher(page)).toHaveAttribute('aria-expanded', 'false');
});

test('il controllo diventa discreto sopra una colonna e torna visibile al passaggio del mouse', async ({
  page,
}) => {
  const last = page.locator('[data-column-id]').last();
  const columnId = (await last.getAttribute('data-column-id'))!;
  const api = await seedApi(page);
  for (let index = 0; index < 12; index++)
    await api.card(columnId, `Scheda sovrapposizione ${index}`);
  await page.reload();
  await expect(last.getByRole('link')).toHaveCount(12);
  await page.getByTestId('kanban').evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await page.mouse.move(500, 20);
  await expect(controls(page)).toHaveAttribute('data-overlapping', 'true');
  await expect(controls(page)).toHaveCSS('opacity', '0.6');
  await openZoom(page);
  await expect(controls(page)).toHaveCSS('opacity', '1');
  await page.mouse.move(500, 20);
  await expect(launcher(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(controls(page)).toHaveCSS('opacity', '0.6');
});

test('il ritorno alle bacheche è un pulsante tondo tra ricerca e Azioni con tooltip', async ({
  page,
}) => {
  const header = page.getByTestId('workspace-page-header');
  const back = header.getByRole('link', { name: 'torna a tutte le bacheche' });
  await expect(back).toHaveAttribute('href', '/boards');
  const searchBox = (await header.getByRole('button', { name: 'Cerca in Jobward' }).boundingBox())!;
  const backBox = (await back.boundingBox())!;
  const menuBox = (await header.getByRole('button', { name: 'Azioni della vista' }).boundingBox())!;
  expect(backBox.x).toBeGreaterThan(searchBox.x);
  expect(backBox.x).toBeLessThan(menuBox.x);
  expect(backBox.width).toBe(backBox.height);
  expect(
    await back.evaluate((el) => parseFloat(getComputedStyle(el).borderRadius)),
  ).toBeGreaterThanOrEqual(backBox.width / 2);
  await back.hover();
  await expect(page.getByRole('tooltip', { name: 'torna a tutte le bacheche' })).toBeVisible();
  await header.getByRole('button', { name: 'Azioni della vista' }).click();
  await expect(page.getByRole('menuitem', { name: 'Tutte le bacheche' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileBack = (await back.boundingBox())!;
  const mobileSearch = (await header
    .getByRole('button', { name: 'Cerca in Jobward' })
    .boundingBox())!;
  expect(Math.round(mobileBack.y)).toBe(Math.round(mobileSearch.y));
  expect(Math.round(mobileBack.width)).toBeGreaterThanOrEqual(44);
  await back.click();
  await expect(page).toHaveURL('/boards');
  await expect(page.getByRole('heading', { level: 1, name: 'Bacheche' })).toBeVisible();
});

test.describe('zoom su touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('un tocco apre i comandi, un secondo tocco o un tocco esterno li chiude', async ({
    page,
  }) => {
    await page.mouse.move(0, 0);
    await expect(launcher(page)).toHaveAttribute('aria-expanded', 'false');
    await launcher(page).tap();
    await expect(launcher(page)).toHaveAttribute('aria-expanded', 'true');
    await controls(page).getByRole('button', { name: 'Riduci lo zoom' }).tap();
    await expect(controls(page).getByRole('status')).toHaveText('90%');
    await expect(launcher(page)).toHaveAttribute('aria-expanded', 'true');
    await launcher(page).tap();
    await expect(launcher(page)).toHaveAttribute('aria-expanded', 'false');
    await launcher(page).tap();
    await expect(launcher(page)).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('heading', { level: 1 }).tap();
    await expect(launcher(page)).toHaveAttribute('aria-expanded', 'false');
  });
});
