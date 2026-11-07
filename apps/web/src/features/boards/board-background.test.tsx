import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { boardDetail } from '@/test/fixtures';
import { mockApi, renderApp, withWorkspace } from '@/test/utils';

describe('Sfondo della bacheca', () => {
  it('annulla la scelta senza richieste e senza cambiare lo sfondo salvato', async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...withWorkspace(),
      'GET /boards/b1': () => ({ body: boardDetail() }),
    });
    renderApp('/boards/b1');
    await user.click(await screen.findByRole('button', { name: 'Azioni della vista' }));
    await user.click(
      await screen.findByRole('menuitem', { name: 'Cambia il background di Ricerca autunno' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Cambia background' });
    expect(within(dialog).getByRole('radio', { name: 'Blu' })).toBeChecked();
    await user.click(within(dialog).getByRole('radio', { name: 'Verde' }));
    expect(screen.getByTestId('board-surface')).toHaveAttribute('data-board-color', 'blue');
    await user.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false);
    expect(screen.getByTestId('board-surface')).toHaveAttribute('data-board-color', 'blue');
  });

  it('salva solo il colore della bacheca corrente e mantiene ogni altro dato', async () => {
    const user = userEvent.setup();
    const state = boardDetail();
    const original = { ...state.board };
    const other = { ...boardDetail(), board: { ...state.board, id: 'b2', color: 'rose' } };
    const calls = mockApi({
      ...withWorkspace(),
      'GET /boards/b1': () => ({ body: state }),
      'GET /boards/b2': () => ({ body: other }),
      'PATCH /boards/b1': ({ body }) => {
        state.board = { ...state.board, ...(body as { color: string | null }) };
        return { body: { board: state.board } };
      },
    });
    const { router, container } = renderApp('/boards/b1');
    await user.click(await screen.findByRole('button', { name: 'Azioni della vista' }));
    await user.click(
      await screen.findByRole('menuitem', { name: 'Cambia il background di Ricerca autunno' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Cambia background' });
    await user.click(within(dialog).getByRole('radio', { name: 'Verde' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salva sfondo' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('board-surface')).toHaveAttribute('data-board-color', 'green');
    const patch = calls.find((call) => call.method === 'PATCH');
    expect(patch).toMatchObject({ path: '/boards/b1?workspaceId=w1', body: { color: 'green' } });
    expect(state.board).toEqual({ ...original, color: 'green' });
    expect(container.querySelector('aside')).not.toHaveClass('board-background');

    await act(() => router.navigate('/boards/b2'));
    await waitFor(() =>
      expect(screen.getByTestId('board-surface')).toHaveAttribute('data-board-color', 'rose'),
    );
    await act(() => router.navigate('/boards/b1'));
    await waitFor(() =>
      expect(screen.getByTestId('board-surface')).toHaveAttribute('data-board-color', 'green'),
    );
  });

  it('mantiene il colore precedente se il salvataggio fallisce e consente di riprovare', async () => {
    const user = userEvent.setup();
    const state = boardDetail();
    let failing = true;
    mockApi({
      ...withWorkspace(),
      'GET /boards/b1': () => ({ body: state }),
      'PATCH /boards/b1': ({ body }) => {
        if (failing) {
          return {
            status: 500,
            body: {
              error: {
                code: 'internal_error',
                message: 'Salvataggio non riuscito',
                requestId: 'r',
              },
            },
          };
        }
        state.board = { ...state.board, ...(body as { color: string | null }) };
        return { body: { board: state.board } };
      },
    });
    renderApp('/boards/b1');
    await user.click(await screen.findByRole('button', { name: 'Azioni della vista' }));
    await user.click(
      await screen.findByRole('menuitem', { name: 'Cambia il background di Ricerca autunno' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Cambia background' });
    await user.click(within(dialog).getByRole('radio', { name: 'Predefinito' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salva sfondo' }));
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('board-surface')).toHaveAttribute('data-board-color', 'blue');
    expect(within(dialog).getByRole('radio', { name: 'Predefinito' })).toBeChecked();
    failing = false;
    await user.click(within(dialog).getByRole('button', { name: 'Salva sfondo' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('board-surface')).toHaveAttribute('data-board-color', 'default');
    expect(state.board.color).toBeNull();
  });
});
