import { workspaceResponse } from '@meet-roulette/schemas';
import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError, apiRequest } from './api';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Sostituisce fetch con una funzione che risponde (o fallisce) come indicato. */
function respondWith(result: Response | Error) {
  const mock = vi.fn(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('apiRequest', () => {
  it('converte il corpo d’errore standard in ApiRequestError con codice e requestId', async () => {
    respondWith(
      json(409, { error: { code: 'conflict', message: 'Già esiste', requestId: 'abc' } }),
    );
    const error = await apiRequest('/workspaces', workspaceResponse).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      status: 409,
      code: 'conflict',
      message: 'Già esiste',
      requestId: 'abc',
    });
  });

  it('rifiuta una risposta con forma diversa dal contratto', async () => {
    respondWith(json(200, { workspace: { id: 1 } }));
    await expect(apiRequest('/workspaces', workspaceResponse)).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('segnala gli errori di rete', async () => {
    respondWith(new TypeError('offline'));
    await expect(apiRequest('/me', workspaceResponse)).rejects.toMatchObject({
      code: 'network_error',
      status: 0,
    });
  });

  it('non espone dettagli se il corpo d’errore non è JSON', async () => {
    respondWith(new Response('<html>boom</html>', { status: 502 }));
    await expect(apiRequest('/me', workspaceResponse)).rejects.toMatchObject({
      code: 'internal_error',
      message: 'Si è verificato un errore imprevisto',
    });
  });

  it('invia JSON con il Content-Type corretto e solo credenziali same-origin', async () => {
    const fetchMock = respondWith(
      json(201, {
        workspace: { id: 'w', name: 'n', timezone: 'UTC', role: 'owner', createdAt: 1 },
      }),
    );
    await apiRequest('/workspaces', workspaceResponse, { method: 'POST', json: { name: 'n' } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/workspaces');
    expect(init.credentials).toBe('same-origin');
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(init.body).toBe('{"name":"n"}');
  });
});
