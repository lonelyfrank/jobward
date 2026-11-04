import type { ApiErrorCode } from '@meet-roulette/shared';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Errore applicativo con codice stabile e status HTTP. Il messaggio è sicuro da mostrare. */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ApiErrorCode,
    message: string,
    readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound = (what = 'Risorsa') => new ApiError(404, 'not_found', `${what} non trovata`);
export const conflict = (message: string) => new ApiError(409, 'conflict', message);
