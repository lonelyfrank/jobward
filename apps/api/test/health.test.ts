import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { call, devEnv } from './helpers';

const app = createApp();

describe('GET /api/health', () => {
  it('è pubblico e non richiede autenticazione', async () => {
    // Ambiente "access" senza token né configurazione: la health deve comunque rispondere.
    const res = await call(
      app,
      devEnv('x@example.com', { AUTH_MODE: 'access', ENVIRONMENT: 'production' }),
      '/api/health',
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('aggiunge id di correlazione, header di sicurezza e nessuna cache', async () => {
    const res = await call(app, devEnv('x@example.com'), '/api/health');
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
  });

  it('risponde con errore JSON standardizzato per percorsi sconosciuti', async () => {
    const res = await call<any>(app, devEnv('x@example.com'), '/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
    expect(res.body.error.requestId).toBe(res.headers.get('x-request-id'));
  });
});
