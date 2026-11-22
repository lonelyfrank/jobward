import { expect, test, type Page } from '@playwright/test';
import { ensureWorkspace, expectNoA11yViolations, seedApi } from './helpers';

// Eliminare una bacheca NON elimina le opportunità (M5-SW.10-a, ADR-0016): restano senza bacheca, con le
// loro informazioni, e si ritrovano in Opportunità, nella ricerca globale e nel dettaglio.
test.describe.configure({ mode: 'serial' });

const BOARD = 'Bacheca SW10a da eliminare';
const TITLE = 'Zibaldone SW10a';
const main = (page: Page) => page.getByRole('main');

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await ensureWorkspace(page);
  await page.close();
});

test('eliminare una bacheca conserva le opportunità, che restano ritrovabili e apribili', async ({
  page,
}) => {
  await ensureWorkspace(page);
  const api = await seedApi(page);
  if (!(await api.findBoard(BOARD))) {
    const board = await api.board(BOARD);
    await api.card(board.columns[0]!.id, TITLE, { company: 'Orbita Zibaldone' });
  }

  // 1. La conferma dichiara cosa succede davvero: le opportunità restano, i campi personalizzati no.
  await page.goto('/boards');
  await page.getByRole('button', { name: `Azioni per “${BOARD}”` }).click();
  await page.getByRole('menuitem', { name: 'Elimina…' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('non vengono eliminate');
  await expect(confirm).toContainText('senza bacheca');
  await expect(confirm).toContainText('campi personalizzati di questa bacheca');
  await expect(confirm).toContainText('non si può annullare');
  await expectNoA11yViolations(page, 'conferma eliminazione bacheca');
  await confirm.getByRole('button', { name: 'Elimina bacheca' }).click();
  await expect(main(page).getByRole('link', { name: BOARD })).toHaveCount(0);

  // 2. L'opportunità è ancora nella Tabella, senza bacheca, e non è sparita in silenzio.
  await page.goto('/opportunities');
  await page.getByRole('searchbox').fill(TITLE);
  const link = page.getByRole('table').getByRole('link', { name: TITLE });
  await expect(link).toBeVisible();
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: TITLE }) });
  await expect(row).toContainText('Senza bacheca');
  await expect(row).toContainText('Orbita Zibaldone');

  // 3. Il dettaglio si apre (non una finestra vuota) e non offre colonne.
  await link.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: TITLE })).toBeVisible();
  await dialog.getByRole('tab', { name: 'Dettagli' }).click();
  const column = dialog.getByLabel('Colonna');
  await expect(column).toBeDisabled();
  await expect(column).toContainText('Senza bacheca');
  await expectNoA11yViolations(page, 'dettaglio di un’opportunità senza bacheca');
  await page.keyboard.press('Escape');

  // 4. La ricerca globale la trova e apre lo stesso dettaglio.
  await page.goto('/');
  await page.getByRole('button', { name: 'Cerca in Jobward' }).click();
  await page.getByRole('combobox').fill('Zibaldone');
  await page.getByRole('option', { name: new RegExp(TITLE) }).click();
  await expect(page).toHaveURL(/\/opportunities\/cards\//);
  await expect(page.getByRole('dialog').getByRole('heading', { name: TITLE })).toBeVisible();

  // 5. Pulizia: archiviata, così gli spec successivi (che contano le opportunità) non la vedono.
  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  await api.archive(id);
});
