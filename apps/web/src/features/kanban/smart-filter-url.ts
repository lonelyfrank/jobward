import { parseSmartFilter } from '@jobward/schemas';
import {
  CONTRACT_TYPES,
  EMPTY_SMART_FILTER,
  isValidDateFilter,
  normalizeSmartFilter,
  NONE,
  PRIORITIES,
  SMART_FILTER_LIMITS,
  STAGES,
  WORK_MODES,
  type DateFilter,
  type PeriodicPreset,
  type SmartFilterConfig,
} from '@jobward/shared';

/**
 * Filtri del Kanban ↔ indirizzo (`?fase=applied&creata=week-1`). Funzioni pure.
 *
 * Privacy: l'indirizzo contiene solo ciò che l'utente ha scelto (vocabolari, ID di etichette,
 * periodi, testo di azienda/località). Nessun identificativo di workspace né dato delle schede.
 *
 * Robustezza: ogni parametro è letto da solo; uno non valido viene scartato senza toccare gli
 * altri. L'indirizzo è un input non fidato: niente qui può lanciare.
 */

/**
 * Parametri gestiti dai filtri; tutto il resto dell'indirizzo viene preservato. Nomi in italiano e
 * distinti da quelli della Tabella (`stage`, `priority`, `label`…): le due viste non si confondono.
 */
export const SMART_FILTER_PARAMS = {
  created: 'creata',
  applied: 'inviata',
  updated: 'aggiornata',
  stage: 'fase',
  company: 'azienda',
  priority: 'priorita',
  workMode: 'modalita',
  contractType: 'contratto',
  labelIds: 'etichetta',
  location: 'localita',
} as const;

const PRESET_CODES: Record<PeriodicPreset, string> = {
  today: 'today',
  this_week: 'week',
  this_month: 'month',
  last_30_days: '30d',
  this_year: 'year',
};
const CODE_PRESETS = Object.fromEntries(
  Object.entries(PRESET_CODES).map(([preset, code]) => [code, preset]),
) as Record<string, PeriodicPreset>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `week` · `week-2` (due settimane fa) · `2026-01-01..2026-02-01` · `2026-01-01..` · `..2026-02-01`. */
export function serializeDateFilter(filter: DateFilter): string {
  if (filter.preset === 'custom') return `${filter.from ?? ''}..${filter.to ?? ''}`;
  const code = PRESET_CODES[filter.preset];
  return filter.offset === 0 ? code : `${code}-${-filter.offset}`;
}

export function parseDateFilter(raw: string): DateFilter | null {
  if (raw.includes('..')) {
    const [from = '', to = '', ...rest] = raw.split('..');
    if (rest.length > 0) return null;
    const bound = (value: string) => (value === '' ? null : DAY.test(value) ? value : undefined);
    const f = bound(from);
    const t = bound(to);
    if (f === undefined || t === undefined) return null;
    const filter: DateFilter = { preset: 'custom', from: f, to: t };
    return isValidDateFilter(filter) ? filter : null;
  }
  const match = /^([0-9a-z]+)(?:-(\d{1,4}))?$/.exec(raw);
  const preset = match ? CODE_PRESETS[match[1]!] : undefined;
  if (!match || !preset) return null;
  const back = match[2] === undefined ? 0 : Number(match[2]);
  const filter: DateFilter = { preset, offset: back === 0 ? 0 : -back };
  return isValidDateFilter(filter) ? filter : null;
}

function only<T extends string>(values: string[], vocabulary: readonly string[]): T[] {
  return values.filter((value): value is T => vocabulary.includes(value));
}

/** Legge i filtri dall'indirizzo. Sempre una configurazione valida (al peggio, quella vuota). */
export function readSmartFilter(params: URLSearchParams): SmartFilterConfig {
  const all = (key: string) =>
    params
      .getAll(key)
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean);
  const date = (key: string) => {
    const raw = params.get(key);
    return raw ? (parseDateFilter(raw) ?? undefined) : undefined;
  };
  const P = SMART_FILTER_PARAMS;
  const draft: SmartFilterConfig = { v: 1 };
  const created = date(P.created);
  const applied = date(P.applied);
  const updated = date(P.updated);
  if (created) draft.created = created;
  if (applied) draft.applied = applied;
  if (updated) draft.updated = updated;
  draft.stage = only(all(P.stage), [...STAGES, NONE]);
  // Aziende e testo possono contenere virgole: si usano parametri ripetuti, mai elenchi con virgola.
  draft.company = params
    .getAll(P.company)
    .map((value) => value.trim().slice(0, SMART_FILTER_LIMITS.textMax))
    .filter(Boolean);
  draft.priority = only(all(P.priority), PRIORITIES);
  draft.workMode = only(all(P.workMode), [...WORK_MODES, NONE]);
  draft.contractType = only(all(P.contractType), [...CONTRACT_TYPES, NONE]);
  draft.labelIds = all(P.labelIds).filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id));
  draft.location = (params.get(P.location) ?? '').slice(0, SMART_FILTER_LIMITS.textMax);
  // Forma canonica (toglie vuoti e duplicati) e doppio controllo con lo schema versionato.
  return parseSmartFilter(normalizeSmartFilter(draft)) ?? EMPTY_SMART_FILTER;
}

/** Copia dei parametri senza quelli dei filtri. */
function withoutFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of Object.values(SMART_FILTER_PARAMS)) next.delete(key);
  return next;
}

/** Scrive i filtri nell'indirizzo (forma canonica, vuoti omessi) preservando gli altri parametri. */
export function writeSmartFilter(
  params: URLSearchParams,
  config: SmartFilterConfig,
): URLSearchParams {
  const c = normalizeSmartFilter(config);
  const next = withoutFilters(params);
  const P = SMART_FILTER_PARAMS;
  if (c.created) next.set(P.created, serializeDateFilter(c.created));
  if (c.applied) next.set(P.applied, serializeDateFilter(c.applied));
  if (c.updated) next.set(P.updated, serializeDateFilter(c.updated));
  if (c.stage) next.set(P.stage, c.stage.join(','));
  for (const company of c.company ?? []) next.append(P.company, company);
  if (c.priority) next.set(P.priority, c.priority.join(','));
  if (c.workMode) next.set(P.workMode, c.workMode.join(','));
  if (c.contractType) next.set(P.contractType, c.contractType.join(','));
  if (c.labelIds) next.set(P.labelIds, c.labelIds.join(','));
  if (c.location) next.set(P.location, c.location);
  return next;
}

/** Vero se l'indirizzo contiene parametri di filtro che la lettura scarterebbe o riscriverebbe. */
export function hasNonCanonicalFilterParams(params: URLSearchParams): boolean {
  const own = (p: URLSearchParams) => {
    const filtered = new URLSearchParams();
    for (const key of Object.values(SMART_FILTER_PARAMS))
      for (const value of p.getAll(key)) filtered.append(key, value);
    return filtered.toString();
  };
  const canonical = writeSmartFilter(new URLSearchParams(), readSmartFilter(params));
  return own(params) !== own(canonical);
}

/**
 * Perché un valore dell'indirizzo non è stato accolto:
 * - `invalid`: fuori vocabolario, data non valida, identificativo malformato;
 * - `truncated`: oltre i limiti (testo troppo lungo o troppi valori): il resto è stato tagliato;
 * - `unknown`: identificativo ben formato ma inesistente (etichetta eliminata o di un altro spazio).
 */
export type RejectedReason = 'invalid' | 'truncated' | 'unknown';

export interface RejectedFilterParam {
  /** Nome del parametro nell'indirizzo (`fase`, `creata`…). */
  param: string;
  /** Il valore scartato; vuoto per `truncated` e `unknown` (non si mostrano identificativi opachi). */
  value: string;
  reason: RejectedReason;
}

/**
 * Valori dei parametri di filtro che la lettura scarta o taglia **cambiando il significato** del
 * filtro. Le variazioni solo cosmetiche (ordine, duplicati, spazi, valori vuoti, maiuscole nelle
 * aziende) NON compaiono: l'indirizzo viene normalizzato, ma non c'è nulla da comunicare.
 *
 * `knownLabelIds`: se noto (elenco etichette già caricato), gli identificativi assenti risultano
 * `unknown`. Senza, non si può sapere e si controlla solo il formato.
 */
export function describeRejectedFilterParams(
  params: URLSearchParams,
  options: { knownLabelIds?: ReadonlySet<string> | undefined } = {},
): RejectedFilterParam[] {
  const P = SMART_FILTER_PARAMS;
  const out: RejectedFilterParam[] = [];
  const seen = new Set<string>();
  const add = (param: string, value: string, reason: RejectedReason) => {
    const key = `${param}\u0000${reason}\u0000${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ param, value, reason });
  };
  const tokens = (key: string) =>
    params
      .getAll(key)
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean);

  // Periodi: la lettura usa il primo valore e lo scarta per intero se non è valido.
  for (const key of [P.created, P.applied, P.updated]) {
    const raw = params.get(key);
    if (raw && parseDateFilter(raw) === null) add(key, raw, 'invalid');
  }

  const vocabularies: [string, readonly string[]][] = [
    [P.stage, [...STAGES, NONE]],
    [P.priority, PRIORITIES],
    [P.workMode, [...WORK_MODES, NONE]],
    [P.contractType, [...CONTRACT_TYPES, NONE]],
  ];
  for (const [key, allowed] of vocabularies)
    for (const token of tokens(key)) if (!allowed.includes(token)) add(key, token, 'invalid');

  const labels = new Set<string>();
  for (const token of tokens(P.labelIds)) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(token)) add(P.labelIds, token, 'invalid');
    else if (options.knownLabelIds && !options.knownLabelIds.has(token))
      add(P.labelIds, '', 'unknown');
    else labels.add(token);
  }
  if (labels.size > SMART_FILTER_LIMITS.maxLabels) add(P.labelIds, '', 'truncated');

  // Testi: aziende (parametro ripetuto) e località.
  const companies = new Set<string>();
  for (const raw of params.getAll(P.company)) {
    const value = raw.trim();
    if (!value) continue;
    if (value.length > SMART_FILTER_LIMITS.textMax) add(P.company, '', 'truncated');
    companies.add(value.slice(0, SMART_FILTER_LIMITS.textMax).toLowerCase());
  }
  if (companies.size > SMART_FILTER_LIMITS.maxCompanies) add(P.company, '', 'truncated');
  if ((params.get(P.location) ?? '').trim().length > SMART_FILTER_LIMITS.textMax)
    add(P.location, '', 'truncated');

  return out;
}
