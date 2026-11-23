import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi, renderApp, withWorkspace } from '@/test/utils';

describe('Profilo: le tue posizioni (D-07)', () => {
  it('aggiunge casa da un link di una mappa, senza chiamate esterne', async () => {
    let places: unknown[] = [];
    const calls = mockApi({
      ...withWorkspace(),
      'GET /me/places': () => ({ body: { places } }),
      'POST /me/places': ({ body }) => {
        const place = { id: 'p1', position: 1, createdAt: 1, updatedAt: 1, ...(body as object) };
        places = [place];
        return { status: 201, body: { place } };
      },
    });
    renderApp('/profile');
    expect(await screen.findByText(/Nessuna posizione/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi una posizione' }));
    expect(screen.getByLabelText('Tipo')).toHaveValue('home');

    await userEvent.type(screen.getByLabelText('Nome'), 'Casa');
    await userEvent.type(
      screen.getByLabelText('Coordinate'),
      'https://www.google.com/maps/place/@45.4642,9.19,15z',
    );
    expect(screen.getByText('Coordinate lette: 45.4642, 9.19')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salva posizione' }));

    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
        name: 'Casa',
        kind: 'home',
        latitude: 45.4642,
        longitude: 9.19,
      }),
    );
    expect(await screen.findByRole('list', { name: 'Posizioni salvate' })).toHaveTextContent(
      'Casa',
    );
    // Solo l'API dell'applicazione: nessun servizio di mappe o geocoding.
    expect(calls.every((c) => !c.path.startsWith('http'))).toBe(true);
  });

  it('testo non riconosciuto: errore accanto al campo, nessun invio', async () => {
    const calls = mockApi({
      ...withWorkspace(),
      'GET /me/places': () => ({ body: { places: [] } }),
    });
    renderApp('/profile');
    await userEvent.click(await screen.findByRole('button', { name: 'Aggiungi una posizione' }));
    await userEvent.type(screen.getByLabelText('Nome'), 'Casa');
    await userEvent.type(screen.getByLabelText('Coordinate'), 'Via Roma 1, Milano');
    await userEvent.click(screen.getByRole('button', { name: 'Salva posizione' }));
    expect(
      await screen.findByText('Non riconosciamo delle coordinate valide in questo testo'),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});
