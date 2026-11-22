/**
 * Normalizzazione del testo per i confronti del motore di query (M5-SW.3).
 *
 * UNICA definizione, condivisa da due valutatori che devono dare lo stesso risultato: quello in
 * memoria (Kanban) e quello SQL (Tabella). Per questo si limita a ciò che SQLite sa fare senza ICU:
 *  1. sostituzione di una tabella FISSA di lettere accentate latine e di segni combinanti;
 *  2. minuscole SOLO per le lettere ASCII (`lower()` di SQLite non tocca il resto di Unicode);
 *  3. spazi (U+0020) ripetuti ridotti a uno, con un numero fisso di passate, poi rifilati.
 *
 * Conseguenze dichiarate (non sono bug): lettere fuori tabella (es. «š», «ő», «ł») e maiuscole
 * non ASCII (greco, cirillico) NON si equivalgono ai loro corrispondenti; tabulazioni e spazi
 * non separabili non sono spazi. Nessuna ricerca fuzzy.
 */

const ACCENTS = 'àáâãäåèéêëìíîïòóôõöùúûüçñÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇÑ';
const BASE = 'aaaaaaeeeeiiiiooooouuuucn'.repeat(2);
const MARKS = '̧̀́̂̃̈̊';

/** Coppie (carattere → sostituto), nell'ordine di applicazione. Usate anche dal compilatore SQL. */
export const FOLD_PAIRS: readonly (readonly [string, string])[] = Object.freeze([
  ...[...ACCENTS].map((letter, index) => [letter, BASE[index]!] as const),
  ...[...MARKS].map((mark) => [mark, ''] as const),
]);

/** Passate di riduzione degli spazi doppi: coprono sequenze fino a 2^N spazi (qui 32). */
export const FOLD_SPACE_PASSES = 5;

/** Chiave di confronto: la stessa funzione, riga per riga, del frammento SQL del compilatore. */
export function foldKey(text: string): string {
  let value = text;
  for (const [accent, base] of FOLD_PAIRS) value = value.replaceAll(accent, base);
  value = value.replace(/[A-Z]+/g, (run) => run.toLowerCase());
  for (let pass = 0; pass < FOLD_SPACE_PASSES; pass++) value = value.replaceAll('  ', ' ');
  return value.replace(/^ +| +$/g, '');
}
