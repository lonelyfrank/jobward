import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Surface } from '@/components/ui/surface';
import { board as boardItem, boardDetail } from '@/test/fixtures';
import { mockApi, renderApp, withWorkspace } from '@/test/utils';

/**
 * Ambito del materiale Glass Subtle: SOLO il contenitore esterno delle colonne Kanban.
 * jsdom non calcola il CSS: qui si verifica a quale elemento il codice assegna il materiale; lo
 * stile effettivo (pseudo-elementi, sfondo trasparente, schede opache) è in e2e/kanban-glass.spec.ts.
 */
const GLASS = '.glass-subtle';

describe('Glass Subtle: ambito', () => {
  it('le colonne Kanban sono vetro; schede, badge e controlli interni no', async () => {
    mockApi({ ...withWorkspace(), 'GET /boards/b1': () => ({ body: boardDetail() }) });
    const { container } = renderApp('/boards/b1');
    // La prima apertura della route (lazy) a freddo può superare il timeout predefinito sotto carico.
    await screen.findByRole('heading', { level: 1, name: 'Ricerca autunno' }, { timeout: 10_000 });

    const columns = [...container.querySelectorAll<HTMLElement>('[data-column-id]')];
    expect(columns.length).toBeGreaterThan(0);
    for (const col of columns) {
      expect(col).toHaveClass('glass-subtle', 'kanban-column-glass');
      // Lo sfondo opaco originale è sostituito, non coperto.
      expect(col).not.toHaveClass('bg-surface-muted');
      expect(col).not.toHaveClass('bg-surface');
      // Nessun discendente (schede incluse) riceve il materiale.
      expect(col.querySelectorAll(GLASS)).toHaveLength(0);
    }

    // Gli unici elementi Glass dell'intera pagina sono i contenitori delle colonne.
    expect(container.querySelectorAll(GLASS)).toHaveLength(columns.length);
    for (const li of within(screen.getByRole('list', { name: 'Schede in Salvate' })).getAllByRole(
      'listitem',
    )) {
      expect(li.closest(GLASS)).toBe(li.closest('[data-column-id]'));
      expect(li).not.toHaveClass('glass-subtle');
    }
  });

  it('l’elenco bacheche non usa Glass', async () => {
    mockApi({
      ...withWorkspace(),
      'GET /boards': () => ({
        body: { boards: [boardItem({ id: 'b1', name: 'Estate' })] },
      }),
    });
    const { container } = renderApp('/boards');
    await screen.findByRole('link', { name: 'Estate' });
    expect(container.querySelectorAll(GLASS)).toHaveLength(0);
  });

  it('Overview non usa Glass', async () => {
    mockApi(withWorkspace());
    const { container } = renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    expect(container.querySelectorAll(GLASS)).toHaveLength(0);
  });

  it('Surface mantiene lo sfondo opaco predefinito', () => {
    const { container } = render(<Surface>contenuto</Surface>);
    const surface = container.firstElementChild!;
    expect(surface).toHaveClass('bg-surface', 'border-border');
    expect(surface).not.toHaveClass('glass-subtle');
  });
});
