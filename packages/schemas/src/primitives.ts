import { LIMITS } from '@jobward/shared';
import { z } from 'zod';

/** Identificativo opaco (UUID testuale). Non si assume alcun formato oltre la lunghezza. */
export const idSchema = z.string().min(1).max(64);

/** Testo breve obbligatorio: viene rifilato e non può essere vuoto. */
export const requiredText = (max: number) =>
  z.string().trim().min(1, 'Campo obbligatorio').max(max);

/** Testo facoltativo: stringa rifilata, oppure null per "nessun valore". */
export const optionalText = (max: number) => z.string().trim().max(max).nullable();

/**
 * Data di calendario senza ora (`YYYY-MM-DD`), usata per date di pubblicazione e
 * candidatura. Non dipende dal fuso orario dell'utente.
 */
export const calendarDate = z.iso.date();

/**
 * Istante nel tempo (ISO 8601 con offset, normalizzato a UTC in persistenza).
 * Usato per scadenze con ora e per i timestamp.
 */
export const instant = z.iso.datetime({ offset: true });

/** Solo URL http(s): scarta `javascript:`, `data:` e altri schemi pericolosi. */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export const httpUrl = z
  .string()
  .trim()
  .max(LIMITS.urlMax)
  .refine(isHttpUrl, 'Inserisci un indirizzo web valido (http o https)');

/** Colore semantico (token), mai un valore CSS arbitrario proveniente dall'utente. */
export const COLOR_TOKENS = [
  'slate',
  'blue',
  'green',
  'amber',
  'violet',
  'rose',
  'teal',
  'orange',
] as const;
export const colorToken = z.enum(COLOR_TOKENS);
export type ColorToken = z.infer<typeof colorToken>;

/** Fuso orario IANA valido, verificato con il runtime. */
export const timezoneSchema = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'Fuso orario non valido');
