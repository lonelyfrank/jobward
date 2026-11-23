import type { Company } from '@jobward/schemas';

/** Ordinamenti dell'elenco delle aziende (valori brevi, salvati nell'indirizzo). */
export const COMPANY_SORTS = ['az', 'za', 'recent', 'oldest'] as const;
export type CompanySort = (typeof COMPANY_SORTS)[number];

export const COMPANY_SORT_LABELS: Record<CompanySort, string> = {
  az: 'Nome A → Z',
  za: 'Nome Z → A',
  recent: 'Più recenti',
  oldest: 'Meno recenti',
};

export const parseCompanySort = (value: string | null): CompanySort =>
  (COMPANY_SORTS as readonly string[]).includes(value ?? '') ? (value as CompanySort) : 'az';

const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

/** Confronto del filtro: senza accenti né maiuscole (solo lato client, quindi Unicode completo). */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('it');

/**
 * Filtra per nome (senza distinguere maiuscole e accenti: «perù» trova «Peru») e ordina.
 * «Più recenti» = aziende inserite per ultime; a parità, per nome.
 */
export function filterAndSortCompanies(
  companies: readonly Company[],
  query: string,
  sort: CompanySort,
): Company[] {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  const filtered = companies.filter((c) => {
    const name = fold(c.name);
    return terms.every((term) => name.includes(term));
  });
  const byName = (a: Company, b: Company) => collator.compare(a.name, b.name);
  const compare: Record<CompanySort, (a: Company, b: Company) => number> = {
    az: byName,
    za: (a, b) => byName(b, a),
    recent: (a, b) => b.createdAt - a.createdAt || byName(a, b),
    oldest: (a, b) => a.createdAt - b.createdAt || byName(a, b),
  };
  return [...filtered].sort(compare[sort]);
}

/** Pagina richiesta riportata nell'intervallo valido (mai una pagina vuota oltre la fine). */
export function paginate<T>(items: readonly T[], page: number, pageSize: number) {
  const size = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  return {
    items: items.slice((current - 1) * size, current * size),
    page: current,
    pageCount,
  };
}
