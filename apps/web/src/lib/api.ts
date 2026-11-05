import type { ApiErrorBody, ApiErrorCode } from '@jobward/shared';
import type { ZodType } from 'zod';

/** Errore restituito dall'API o dalla rete. L'interfaccia si basa su `code`, non sul messaggio. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'network_error' | 'invalid_response',
    message: string,
    readonly requestId?: string,
    /** Errori di validazione per campo, se il server li ha forniti. */
    readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function readError(res: Response): Promise<ApiRequestError> {
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>;
    if (body.error?.code && body.error.message) {
      return new ApiRequestError(
        res.status,
        body.error.code,
        body.error.message,
        body.error.requestId,
        body.error.issues,
      );
    }
  } catch {
    /* corpo non JSON: errore generico sotto */
  }
  return new ApiRequestError(res.status, 'internal_error', 'Si è verificato un errore imprevisto');
}

/**
 * Chiamata all'API same-origin. La risposta viene VALIDATA con lo stesso schema Zod
 * usato dal contratto: un backend che cambia forma produce un errore chiaro,
 * non dati corrotti nell'interfaccia.
 */
export async function apiRequest<T>(
  path: string,
  schema: ZodType<T>,
  init: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    json?: unknown;
    /** Permette di annullare la richiesta (es. ricerca superata da una più recente). */
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      headers: init.json !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      signal: init.signal ?? null,
    });
  } catch (error) {
    // Una richiesta annullata non è un errore di rete: chi l'ha annullata la ignora.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiRequestError(0, 'network_error', 'Impossibile contattare il server');
  }

  if (!res.ok) throw await readError(res);

  const parsed = schema.safeParse(await res.json().catch(() => undefined));
  if (!parsed.success) {
    throw new ApiRequestError(
      res.status,
      'invalid_response',
      'Risposta del server non riconosciuta',
    );
  }
  return parsed.data;
}
