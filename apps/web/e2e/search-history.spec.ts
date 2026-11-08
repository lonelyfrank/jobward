import { expect, test } from '@playwright/test';
import { ensureWorkspace, seedApi } from './helpers';

test('Indietro immediato durante il commit URL annulla anche il filtro ottimistico', async ({
  page,
}) => {
  await ensureWorkspace(page);
  const api = await seedApi(page);
  const board = await api.board('Regressione cronologia ricerca');
  await api.card(board.columns[0]!.id, 'Prima opportunità cronologia', {
    priority: 'high',
    stage: 'applied',
  });
  await api.card(board.columns[0]!.id, 'Seconda opportunità cronologia', {
    priority: 'high',
    stage: 'interviewing',
  });
  await page.goto(`/boards/${board.id}/table?priority=high`);
  const results = page.getByRole('status').filter({ hasText: /risultat/ });
  await expect(results).toHaveText('2 risultati');
  // Riproduce Back fra pushState (URL già aggiornato) e commit React del router.
  // Il risultato ottimistico può essere già arrivato in questo intervallo.
  await page.evaluate(() => {
    const push = history.pushState.bind(history);
    history.pushState = (...args) => {
      push(...args);
      if (new URL(location.href).searchParams.has('stage')) {
        addEventListener(
          'popstate',
          () => document.documentElement.setAttribute('data-history-returned', 'true'),
          { once: true },
        );
        queueMicrotask(() => history.back());
      }
    };
  });
  const saved = page
    .getByRole('group', { name: 'Fase', exact: true })
    .getByLabel('Salvata', { exact: true });
  // click: il Back intenzionale annulla subito la spunta, quindi check() sarebbe inappropriato.
  await saved.click();
  await expect(page.locator('html')).toHaveAttribute('data-history-returned', 'true');
  await expect(page).not.toHaveURL(/[?&]stage=/);
  await expect(saved).not.toBeChecked();
  await expect(results).toHaveText('2 risultati');
  await expect(page.getByRole('button', { name: 'Rimuovi il filtro: Fase: Salvata' })).toHaveCount(
    0,
  );
});
