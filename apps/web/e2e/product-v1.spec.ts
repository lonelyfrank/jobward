import { expect, test } from '@playwright/test';
import { ensureWorkspace, expectNoA11yViolations } from './helpers';

// Flussi v1: inserimento guidato, pipeline canonica, aziende e duplicati, viste salvate.
test.describe.configure({ mode: 'serial' });

const TITLE = 'Sistemista Linux v1';
const COMPANY = 'Acme Servizi S.r.l.';

test('inserimento guidato: salva un’opportunità già candidata in quattro passi', async ({
  page,
}) => {
  await ensureWorkspace(page);
  await page.goto('/opportunities');
  await page.getByRole('button', { name: 'Azioni della vista' }).click();
  await page.getByRole('menuitem', { name: 'Nuova opportunità' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuova opportunità' });
  await dialog.getByLabel('Titolo').fill(TITLE);
  await dialog.getByLabel('Azienda (facoltativa)').fill(COMPANY);
  await dialog.getByRole('button', { name: 'Avanti' }).click();
  await dialog.getByLabel('Sede').fill('Torino');
  await dialog.getByRole('button', { name: 'Avanti' }).click();
  await dialog.getByLabel('Il tuo interesse').selectOption('4');
  await dialog.getByRole('button', { name: 'Avanti' }).click();
  await dialog.getByText('Sì, ho già inviato la candidatura').click();
  await dialog.getByLabel('Data d’invio').fill('2026-11-10');
  await dialog.getByLabel('Canale', { exact: true }).fill('Sito aziendale');
  await expectNoA11yViolations(page, 'inserimento guidato — candidatura');
  await dialog.getByRole('button', { name: 'Salva opportunità' }).click();
  await expect(
    page.getByText(`Opportunità “${TITLE}” salvata nell’Inbox e candidatura registrata.`),
  ).toBeVisible();
});

test('pipeline canonica: «Sposta in…» chiede conferma e cambia lo stato', async ({ page }) => {
  await page.goto('/pipeline');
  const column = (name: string) => page.getByRole('region', { name: new RegExp(`^${name}`) });
  await expect(column('Inviate').getByRole('link', { name: TITLE })).toBeVisible();
  await page.getByRole('button', { name: `Sposta «${TITLE}» in un altro stato` }).click();
  await page.getByRole('menuitem', { name: 'Colloqui' }).click();
  await page.getByRole('button', { name: 'Conferma passaggio' }).click();
  await expect(column('Colloqui').getByRole('link', { name: TITLE })).toBeVisible();
  await expectNoA11yViolations(page, 'pipeline');
});

test('aziende e duplicati: la stessa azienda scritta diversamente è riconosciuta', async ({
  page,
}) => {
  await page.goto('/opportunities');
  await page.getByRole('button', { name: 'Azioni della vista' }).click();
  await page.getByRole('menuitem', { name: 'Nuova opportunità' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuova opportunità' });
  await dialog.getByLabel('Titolo').fill('sistemista linux v1');
  await dialog.getByLabel('Azienda (facoltativa)').fill('ACME SERVIZI srl');
  await expect(dialog.getByText('Forse l’hai già salvata:')).toBeVisible();
  await expect(dialog.getByRole('link', { name: TITLE })).toBeVisible();
  await dialog.getByRole('button', { name: 'Annulla' }).click();

  await page
    .getByRole('navigation', { name: 'Navigazione principale' })
    .getByRole('link', { name: 'Aziende' })
    .click();
  await page.getByRole('link', { name: new RegExp(COMPANY.replace('.', '\\.')) }).click();
  await expect(page.getByRole('heading', { level: 1, name: COMPANY })).toBeVisible();
  await expect(page.getByRole('link', { name: TITLE })).toBeVisible();
  await expectNoA11yViolations(page, 'dettaglio azienda');
});

test('viste salvate: salva, ritrova con un clic ed elimina', async ({ page }) => {
  await page.goto('/opportunities?vista=applications&sort=title');
  await page.getByRole('button', { name: 'Salva vista' }).click();
  await page.getByLabel('Nome della vista').fill('Candidature per titolo');
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  const chip = page.getByRole('link', { name: 'Candidature per titolo' });
  await expect(chip).toHaveAttribute('aria-current', 'true');

  await page.getByRole('button', { name: 'Tutte' }).click();
  await expect(chip).not.toHaveAttribute('aria-current', 'true');
  await chip.click();
  await expect(page).toHaveURL(/vista=applications/);
  await expect(page).toHaveURL(/sort=title/);

  await page.getByRole('button', { name: 'Azioni della vista «Candidature per titolo»' }).click();
  await page.getByRole('menuitem', { name: 'Elimina' }).click();
  await expect(chip).toHaveCount(0);
});
