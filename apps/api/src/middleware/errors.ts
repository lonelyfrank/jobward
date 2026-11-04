import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ApiErrorBody, ApiErrorCode } from '@meet-roulette/shared';
import type { AppEnv } from '../env';
import { ApiError } from '../lib/errors';

function body(
  c: Parameters<ErrorHandler<AppEnv>>[1],
  code: ApiErrorCode,
  message: string,
  issues?: ApiErrorBody['error']['issues'],
): ApiErrorBody {
  return {
    error: {
      code,
      message,
      requestId: c.get('requestId') ?? 'unknown',
      ...(issues ? { issues } : {}),
    },
  };
}

/** Risposte d'errore standardizzate. Gli errori imprevisti non espongono dettagli interni. */
export const onError: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof ApiError) {
    return c.json(body(c, err.code, err.message, err.issues), err.status);
  }
  if (err instanceof HTTPException) {
    const code: ApiErrorCode = err.status === 404 ? 'not_found' : 'validation_error';
    return c.json(body(c, code, 'Richiesta non valida'), err.status);
  }

  // Si registra solo il tipo di errore e l'id di correlazione: né stack, né dati utente.
  console.error(
    JSON.stringify({
      level: 'error',
      msg: 'unhandled_error',
      requestId: c.get('requestId'),
      name: err instanceof Error ? err.name : 'UnknownError',
    }),
  );
  return c.json(body(c, 'internal_error', 'Si è verificato un errore imprevisto'), 500);
};

export const onNotFound: NotFoundHandler<AppEnv> = (c) =>
  c.json(body(c, 'not_found', 'Risorsa non trovata'), 404);
