import type { Context } from 'hono';
import type { ZodType } from 'zod';
import { ApiError } from './errors';

function toIssues(error: { issues: readonly { path: PropertyKey[]; message: string }[] }) {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/** Legge e valida il body JSON. Qualunque errore diventa un 400 standardizzato. */
export async function parseJsonBody<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError(400, 'validation_error', 'Il corpo della richiesta non è JSON valido');
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ApiError(400, 'validation_error', 'Dati non validi', toIssues(result.error));
  }
  return result.data;
}

export function parseQuery<T>(c: Context, schema: ZodType<T>): T {
  const result = schema.safeParse(c.req.query());
  if (!result.success) {
    throw new ApiError(400, 'validation_error', 'Parametri non validi', toIssues(result.error));
  }
  return result.data;
}
