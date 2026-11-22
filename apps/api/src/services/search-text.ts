import { FOLD_PAIRS } from '@jobward/shared';

/**
 * Normalizzazione dei diacritici latini comuni, anche nei dati NFD. Nessun fuzzy matching.
 * La tabella è QUELLA del motore di query (`FOLD_PAIRS` in `@jobward/shared`): una sola definizione.
 */
const PAIRS = FOLD_PAIRS;

export function foldText(text: string) {
  return PAIRS.reduce(
    (value, [accent, base]) => value.replaceAll(accent, base),
    text,
  ).toLowerCase();
}

/** Solo espressioni SQL costanti del servizio; mai input dell'utente. */
export function foldSql(expression: string): string {
  let value = `coalesce(${expression}, '')`;
  // Piccoli blocchi evitano l'overflow del parser SQLite con decine di replace annidati.
  for (let start = 0; start < PAIRS.length; start += 8) {
    const replacements = PAIRS.slice(start, start + 8).reduce(
      (sql, [accent, base]) => `replace(${sql}, '${accent}', '${base}')`,
      'value',
    );
    value = `(SELECT ${replacements} FROM (SELECT ${value} AS value))`;
  }
  return `lower(${value})`;
}

export const searchTerms = (text: string) => foldText(text).split(/\s+/).filter(Boolean);
/**
 * Sottostringa letterale senza pattern LIKE (D1 li limita a 50 byte).
 * lower SQL conserva il case-fold ASCII di LIKE; non applica un nuovo fold Unicode.
 * Entrambi i frammenti sono espressioni SQL costanti/placeholder, mai valori utente.
 */
export const containsSql = (text: string, parameter: string) =>
  `instr(lower(${text}), lower(${parameter})) > 0`;
