import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { call, devEnv } from './helpers';

const app = createApp();

afterEach(() => vi.restoreAllMocks());

describe('log delle richieste', () => {
  it('non contengono token, cookie, query string né body', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await call(app, devEnv('log@example.com'), '/api/v1/overview?workspaceId=SECRET-QUERY', {
      headers: {
        'cf-access-jwt-assertion': 'SECRET-JWT',
        cookie: 'CF_Authorization=SECRET-COOKIE',
        authorization: 'Bearer SECRET-BEARER',
      },
    });
    await call(app, devEnv('log@example.com'), '/api/v1/workspaces', {
      method: 'POST',
      json: { name: 'SECRET-BODY' },
    });
    // Anche un errore imprevisto non deve far trapelare nulla.
    await call(app, { ...devEnv('log@example.com'), DB: undefined as never }, '/api/v1/me', {
      headers: { 'cf-access-jwt-assertion': 'SECRET-JWT' },
    });

    const output = [...log.mock.calls, ...error.mock.calls].flat().join('\n');
    expect(output).toContain('"msg":"request"');
    expect(output).toContain('"requestId"');
    expect(output).not.toMatch(/SECRET/);
    expect(output).not.toContain('log@example.com');
  });
});
