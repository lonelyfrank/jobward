import { validateSmartQuery, type SmartQuery } from '@jobward/shared';
import { z } from 'zod';

/**
 * Query v2 (M5-SW.3) come contratto: la validazione STRETTA vive in `@jobward/shared`
 * (`validateSmartQuery`), qui la si espone come schema Zod per le API e le viste salvate.
 * Chiavi sconosciute, operatori non ammessi dal campo, valori fuori vocabolario, gruppi vuoti,
 * duplicati e superamento dei limiti sono errori con il loro percorso. L'esito è la forma canonica.
 */
export const smartQuerySchema = z.unknown().transform((input, ctx): SmartQuery => {
  const result = validateSmartQuery(input);
  if (result.ok) return result.query;
  for (const issue of result.issues) {
    ctx.addIssue({
      code: 'custom',
      message: issue.message,
      path: issue.path === '(query)' ? [] : issue.path.split('.'),
    });
  }
  return z.NEVER;
});

/** Dimensione massima della query serializzata in un parametro d'indirizzo. */
export const SMART_QUERY_MAX_JSON = 4096;

/** Query serializzata (JSON in un parametro) → query validata. */
export const smartQueryJson = z
  .string()
  .max(SMART_QUERY_MAX_JSON, 'Query troppo lunga')
  .transform((text, ctx): unknown => {
    try {
      return JSON.parse(text);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'JSON non valido' });
      return z.NEVER;
    }
  })
  .pipe(smartQuerySchema);

/** Query valida in forma canonica o `null`: chi legge da una fonte esterna non lancia. */
export function parseSmartQuery(input: unknown): SmartQuery | null {
  const parsed = smartQuerySchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}
