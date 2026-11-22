import {
  NONE,
  resolveDateFilter,
  type DateFilter,
  type DatePreset,
  type DateRange,
  type SmartFilterConfig,
} from '@jobward/shared';
import { formatCalendarDate } from '@/lib/format';
import { CONTRACT_LABELS, PRIORITY_LABELS, STAGE_LABELS, WORK_MODE_LABELS } from '@/lib/labels';

/** Testi dell'interfaccia per i filtri. Funzioni pure: nessun accesso a React o al DOM. */

export type DateKey = 'created' | 'applied' | 'updated';

export const DATE_FIELD_LABELS: Record<DateKey, string> = {
  created: 'Data di creazione',
  applied: 'Data di invio candidatura',
  updated: 'Ultimo aggiornamento',
};
const DATE_CHIP_PREFIX: Record<DateKey, string> = {
  created: 'Creata',
  applied: 'Inviata',
  updated: 'Aggiornata',
};

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Oggi',
  this_week: 'Questa settimana',
  this_month: 'Questo mese',
  last_30_days: 'Ultimi 30 giorni',
  this_year: 'Anno corrente',
  custom: 'Intervallo personalizzato',
};

/** «9 nov 2026 – 15 nov 2026», «dal …», «fino al …» oppure il solo giorno. */
export function formatRange(range: DateRange): string {
  const from = formatCalendarDate(range.from);
  const to = formatCalendarDate(range.to);
  if (from && to) return from === to ? from : `${from} – ${to}`;
  if (from) return `dal ${from}`;
  if (to) return `fino al ${to}`;
  return '';
}

/** Periodo corrente per nome («Questa settimana»), altrimenti l'intervallo di giorni che copre. */
export function dateFilterText(filter: DateFilter, today: string): string {
  if (filter.preset !== 'custom' && filter.offset === 0) return DATE_PRESET_LABELS[filter.preset];
  return formatRange(resolveDateFilter(filter, today));
}

export interface FilterChip {
  /** Chiave stabile del campo (anche per i test). */
  key: string;
  text: string;
  /** Presente sui filtri data: abilita la navigazione temporale sul contrassegno. */
  date?: { key: DateKey; filter: DateFilter };
}

const names = <T extends string>(
  values: readonly string[],
  labels: Record<T, string>,
  none: string,
) => values.map((value) => (value === NONE ? none : (labels[value as T] ?? value))).join(', ');

/** Un contrassegno per campo attivo, nell'ordine in cui compaiono nel pannello. */
export function filterChips(
  config: SmartFilterConfig,
  options: { today: string; labelName: (id: string) => string },
): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const key of ['created', 'applied', 'updated'] as const) {
    const filter = config[key];
    if (filter)
      chips.push({
        key,
        text: `${DATE_CHIP_PREFIX[key]}: ${dateFilterText(filter, options.today)}`,
        date: { key, filter },
      });
  }
  if (config.stage)
    chips.push({
      key: 'stage',
      text: `Fase: ${names(config.stage, STAGE_LABELS, 'non indicata')}`,
    });
  if (config.company) chips.push({ key: 'company', text: `Azienda: ${config.company.join(', ')}` });
  if (config.priority)
    chips.push({
      key: 'priority',
      text: `Priorità: ${names(config.priority, PRIORITY_LABELS, 'nessuna')}`,
    });
  if (config.workMode)
    chips.push({
      key: 'workMode',
      text: `Modalità: ${names(config.workMode, WORK_MODE_LABELS, 'non indicata')}`,
    });
  if (config.contractType)
    chips.push({
      key: 'contractType',
      text: `Contratto: ${names(config.contractType, CONTRACT_LABELS, 'non indicato')}`,
    });
  if (config.labelIds)
    chips.push({
      key: 'labelIds',
      text: `Etichette: ${config.labelIds.map(options.labelName).join(', ')}`,
    });
  if (config.location) chips.push({ key: 'location', text: `Località: “${config.location}”` });
  return chips;
}

/** Testo del contatore: «12 di 40 schede» con filtri attivi, «40 schede» senza. */
export function countText(visible: number, total: number, active: boolean): string {
  const noun = (n: number) => (n === 1 ? 'scheda' : 'schede');
  return active ? `${visible} di ${total} ${noun(total)}` : `${total} ${noun(total)}`;
}
