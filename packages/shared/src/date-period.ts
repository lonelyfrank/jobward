import { addDays, dayNumber, isCalendarDate } from './tasks';

/**
 * Periodi di calendario dei filtri (M5-SW.1), condivisi dal filtro v1 e dal motore di query v2
 * (M5-SW.3). Funzioni pure: «oggi» è sempre un argomento (data locale del workspace).
 */

/** Quanti periodi indietro si può navigare (≈ 100 anni di mesi). */
export const DATE_OFFSET_MAX = 1200;

/** Preset temporali. `custom` usa un intervallo di date di calendario scelto dall'utente. */
export const DATE_PRESETS = [
  'today',
  'this_week',
  'this_month',
  'last_30_days',
  'this_year',
  'custom',
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];
export type PeriodicPreset = Exclude<DatePreset, 'custom'>;
export const PERIODIC_PRESETS = DATE_PRESETS.filter(
  (preset): preset is PeriodicPreset => preset !== 'custom',
);

/**
 * Periodo relativo a «oggi» (`offset` 0 = periodo corrente, −1 = il precedente, …) oppure un
 * intervallo personalizzato con estremi inclusi (uno dei due può mancare: intervallo aperto).
 */
export type DateFilter =
  | { preset: PeriodicPreset; offset: number }
  | { preset: 'custom'; from: string | null; to: string | null };

// ---------------------------------------------------------------------------
// Periodi
// ---------------------------------------------------------------------------

export interface DateRange {
  /** Primo giorno incluso (`null` = nessun limite inferiore). */
  from: string | null;
  /** Ultimo giorno incluso (`null` = nessun limite superiore). */
  to: string | null;
}

const p2 = (n: number) => String(n).padStart(2, '0');
const p4 = (n: number) => String(n).padStart(4, '0');

function monthStart(year: number, monthIndex: number): string {
  // monthIndex può essere fuori da 0..11: si normalizza (anno e mese si riportano nell'intervallo).
  const y = year + Math.floor(monthIndex / 12);
  const m = ((monthIndex % 12) + 12) % 12;
  return `${p4(y)}-${p2(m + 1)}-01`;
}

function ymd(date: string): { y: number; m: number; d: number } {
  return { y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)), d: Number(date.slice(8, 10)) };
}

/** Giorno della settimana con lunedì = 0 (la settimana italiana comincia di lunedì). */
export function weekdayIndex(date: string): number {
  const n = dayNumber(date);
  if (n === null) throw new RangeError(`Data di calendario non valida: ${date}`);
  // 1970-01-01 era un giovedì.
  return (((n + 3) % 7) + 7) % 7;
}

/**
 * Intervallo di giorni (estremi inclusi) di un filtro data, relativo a `today`.
 * L'aritmetica è sui giorni di calendario: ora legale e fusi non spostano mai un confine.
 */
export function resolveDateFilter(filter: DateFilter, today: string): DateRange {
  if (filter.preset === 'custom') return { from: filter.from, to: filter.to };
  const offset = filter.offset;
  switch (filter.preset) {
    case 'today': {
      const day = addDays(today, offset);
      return { from: day, to: day };
    }
    case 'this_week': {
      const monday = addDays(today, -weekdayIndex(today) + offset * 7);
      return { from: monday, to: addDays(monday, 6) };
    }
    case 'this_month': {
      const { y, m } = ymd(today);
      const first = monthStart(y, m - 1 + offset);
      const { y: ny, m: nm } = ymd(first);
      return { from: first, to: addDays(monthStart(ny, nm), -1) };
    }
    case 'last_30_days': {
      const to = addDays(today, offset * 30);
      return { from: addDays(to, -29), to };
    }
    case 'this_year': {
      const { y } = ymd(today);
      const year = y + offset;
      return { from: `${p4(year)}-01-01`, to: `${p4(year)}-12-31` };
    }
  }
}

/** Un filtro data è valido se i suoi estremi esistono, sono ordinati e (se presenti) non è vuoto. */
export function isValidDateFilter(filter: DateFilter): boolean {
  if (filter.preset !== 'custom') {
    return (
      Number.isInteger(filter.offset) && filter.offset <= 0 && filter.offset >= -DATE_OFFSET_MAX
    );
  }
  const { from, to } = filter;
  if (from === null && to === null) return false;
  if (from !== null && !isCalendarDate(from)) return false;
  if (to !== null && !isCalendarDate(to)) return false;
  return !(from !== null && to !== null && from > to);
}

/**
 * Navigazione temporale: sposta il periodo di un passo (−1 = indietro, +1 = avanti). I periodi
 * futuri non esistono (si arriva al massimo al periodo corrente). Un intervallo personalizzato
 * si sposta della propria ampiezza; uno aperto da un lato non è navigabile.
 */
export function shiftDateFilter(filter: DateFilter, direction: -1 | 1): DateFilter | null {
  if (filter.preset !== 'custom') {
    const offset = filter.offset + direction;
    return offset > 0 || offset < -DATE_OFFSET_MAX ? null : { preset: filter.preset, offset };
  }
  const { from, to } = filter;
  if (from === null || to === null) return null;
  const span = (dayNumber(to) ?? 0) - (dayNumber(from) ?? 0) + 1;
  try {
    return {
      preset: 'custom',
      from: addDays(from, direction * span),
      to: addDays(to, direction * span),
    };
  } catch {
    return null; // oltre il calendario rappresentabile
  }
}
