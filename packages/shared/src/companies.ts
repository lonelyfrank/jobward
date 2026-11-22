/**
 * Aziende e duplicati (B-05): normalizzazioni DETERMINISTICHE, mai inferenze opache. Servono a
 * riconoscere la stessa azienda scritta in modi diversi («Vela Servizi S.r.l.» = «vela servizi») e a
 * segnalare possibili duplicati senza fondere nulla in automatico.
 */

/** Forme giuridiche comuni ignorate nel confronto (solo in coda al nome). */
const LEGAL_FORMS = new Set([
  'srl',
  'srls',
  'spa',
  'snc',
  'sas',
  'sapa',
  'scarl',
  'scrl',
  'onlus',
  'ltd',
  'llc',
  'inc',
  'gmbh',
  'ag',
  'sa',
  'sl',
  'bv',
  'plc',
  'co',
]);

const fold = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** Parole significative di un testo: senza accenti, punteggiatura e spazi ripetuti. */
function words(value: string): string[] {
  return fold(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/** Chiave dell'azienda: «Vela Servizi S.r.l.» → «vela servizi». Vuota se non resta nulla. */
export function companyKey(name: string): string {
  // «S.r.l.» → «srl»: si uniscono le sigle puntate prima di spezzare le parole.
  const compact = fold(name).replace(/\b((?:\p{L}\.){2,})/gu, (m) => m.replaceAll('.', ''));
  const parts = words(compact);
  while (parts.length > 1 && LEGAL_FORMS.has(parts.at(-1)!)) parts.pop();
  return parts.join(' ');
}

/** URL di un annuncio senza schema, «www.», parametri di tracciamento, frammento e barra finale. */
export function listingUrlKey(url: string): string {
  const match = /^\s*(?:[a-z][a-z0-9+.-]*:)?\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/i.exec(url);
  if (!match) return url.trim().toLowerCase();
  const host = match[1]!.toLowerCase().replace(/^www\./, '');
  const path = match[2]!.replace(/\/+$/, '');
  const params = (match[3] ?? '')
    .slice(1)
    .split('&')
    .filter((p) => p !== '' && !/^(utm_|fbclid|gclid|ref|trk|tracking)/i.test(p))
    .sort();
  return `${host}${path}${params.length ? `?${params.join('&')}` : ''}`;
}

/** Somiglianza dei titoli (Jaccard sulle parole significative), tra 0 e 1. */
export function titleSimilarity(a: string, b: string): number {
  const stop = new Set(['e', 'di', 'da', 'del', 'della', 'in', 'per', 'the', 'and', 'of', 'a']);
  const x = new Set(words(a).filter((w) => !stop.has(w)));
  const y = new Set(words(b).filter((w) => !stop.has(w)));
  if (x.size === 0 || y.size === 0) return 0;
  let common = 0;
  for (const w of x) if (y.has(w)) common += 1;
  return common / (x.size + y.size - common);
}

export interface DuplicateCandidate {
  id: string;
  title: string;
  company: string | null;
  sourceUrl: string | null;
}

export type DuplicateReason = 'same_url' | 'same_company_similar_title' | 'same_title';

/**
 * Possibili duplicati di una nuova opportunità. Regole dichiarate:
 * - stesso link all'annuncio (normalizzato);
 * - stessa azienda (chiave) e titoli simili (≥ 0,6);
 * - stesso titolo normalizzato quando l'azienda non è indicata da una delle due parti.
 */
export function findDuplicates(
  input: { title: string; company?: string | null; sourceUrl?: string | null },
  candidates: DuplicateCandidate[],
): { id: string; reason: DuplicateReason }[] {
  const url = input.sourceUrl ? listingUrlKey(input.sourceUrl) : null;
  const company = input.company ? companyKey(input.company) : '';
  const title = words(input.title).join(' ');
  const out: { id: string; reason: DuplicateReason }[] = [];
  for (const c of candidates) {
    if (url && c.sourceUrl && listingUrlKey(c.sourceUrl) === url) {
      out.push({ id: c.id, reason: 'same_url' });
      continue;
    }
    const other = c.company ? companyKey(c.company) : '';
    if (company && other && company === other) {
      if (titleSimilarity(input.title, c.title) >= 0.6) {
        out.push({ id: c.id, reason: 'same_company_similar_title' });
      }
      continue;
    }
    if ((!company || !other) && title !== '' && words(c.title).join(' ') === title) {
      out.push({ id: c.id, reason: 'same_title' });
    }
  }
  return out;
}
