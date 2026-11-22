import { PRIORITIES, type Priority, type TaskStatus } from './constants';

/**
 * Dominio puro delle attività (M3 Tasks). Nessun I/O e nessuna lettura dell'orologio: «oggi» è
 * SEMPRE un argomento (data locale del workspace). Le date di scadenza sono giorni di calendario
 * `YYYY-MM-DD`: non si spostano con il fuso o con l'ora legale; cambia solo il significato di «oggi».
 */

export const TASK_SOON_DAYS = 3;
export type TaskDue = 'overdue' | 'today' | 'soon' | 'later' | 'none';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** Giorni dall'epoca (UTC) di una data di calendario valida; `null` se la data non esiste. */
export function dayNumber(date: string): number | null {
  const m = DATE_RE.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d)
    return null; // es. 2026-02-30
  return Math.round(ms / DAY_MS);
}

export function isCalendarDate(value: string): boolean {
  return dayNumber(value) !== null;
}

function fromDayNumber(n: number): string {
  const d = new Date(n * DAY_MS);
  const p = (v: number, w = 2) => String(v).padStart(w, '0');
  return `${p(d.getUTCFullYear(), 4)}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

function need(date: string): number {
  const n = dayNumber(date);
  if (n === null) throw new RangeError(`Data di calendario non valida: ${date}`);
  return n;
}

/** Aritmetica su giorni di calendario: indipendente da fuso e ora legale. */
export function addDays(date: string, days: number): string {
  return fromDayNumber(need(date) + days);
}

/** `to − from` in giorni interi di calendario. */
export function daysBetween(from: string, to: string): number {
  return need(to) - need(from);
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Data di calendario `YYYY-MM-DD` dell'istante nel fuso IANA indicato. Fuso non valido → errore. */
export function localDate(instantMs: number, timeZone: string): string {
  const parts = formatterFor(timeZone).formatToParts(new Date(instantMs));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year').padStart(4, '0')}-${get('month')}-${get('day')}`;
}

/**
 * Primo istante (ms UTC, precisione al minuto) della data locale indicata. Serve SOLO alla
 * retrocompatibilità di Overview (`upcomingTasks[].dueAt`). Gestisce fusi da −12 a +14 e ore legali
 * che saltano la mezzanotte (il primo istante esistente di quel giorno).
 */
export function startOfLocalDay(date: string, timeZone: string): number {
  const base = need(date) * DAY_MS;
  const step = 15 * 60_000;
  let t = base - 15 * 3_600_000;
  const end = base + 14 * 3_600_000;
  for (; t <= end; t += step) {
    if (localDate(t, timeZone) === date) {
      while (localDate(t - 60_000, timeZone) === date) t -= 60_000;
      return t;
    }
  }
  throw new RangeError(`Nessun istante per ${date} in ${timeZone}`);
}

export function taskStatus(row: {
  completedAt: number | null;
  cancelledAt: number | null;
}): TaskStatus {
  if (row.cancelledAt !== null) return 'cancelled';
  if (row.completedAt !== null) return 'done';
  return 'open';
}

/** Condizione temporale DERIVATA (mai salvata). Vale solo per le attività aperte. */
export function classifyDue(dueOn: string | null, status: TaskStatus, today: string): TaskDue {
  if (status !== 'open' || dueOn === null) return 'none';
  const diff = daysBetween(today, dueOn);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return diff <= TASK_SOON_DAYS ? 'soon' : 'later';
}

/** Completata dopo la scadenza (data locale di completamento > data di scadenza). */
export function completedLate(
  dueOn: string | null,
  completedAt: number | null,
  timeZone: string,
): boolean {
  if (dueOn === null || completedAt === null) return false;
  return daysBetween(dueOn, localDate(completedAt, timeZone)) > 0;
}

export const PRIORITY_RANK: Readonly<Record<Priority, number>> = Object.freeze(
  Object.fromEntries(PRIORITIES.map((p, i) => [p, i])) as Record<Priority, number>,
);

export interface TaskOrderKey {
  dueOn: string | null;
  priority: Priority;
  createdAt: number;
  id: string;
}

/**
 * Ordine operativo delle attività aperte: scadenza crescente (le senza data per ultime), priorità
 * decrescente, creazione crescente, id crescente. «Scadute < oggi < prossime < senza data» coincide
 * con `dueOn` crescente: l'ordine NON dipende da «oggi» (cursore stabile a cavallo di mezzanotte).
 */
export function compareTasks(a: TaskOrderKey, b: TaskOrderKey): number {
  if (a.dueOn !== b.dueOn) {
    if (a.dueOn === null) return 1;
    if (b.dueOn === null) return -1;
    return a.dueOn < b.dueOn ? -1 : 1;
  }
  return (
    PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
    a.createdAt - b.createdAt ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

export interface TaskSummaryRow {
  dueOn: string | null;
  status: TaskStatus;
}
export interface TaskCounts {
  open: number;
  today: number;
  overdue: number;
  noDue: number;
  done: number;
}

/** Riepilogo puro: oracolo dei conteggi calcolati in SQL. Le annullate non contano. */
export function summarizeTasks(rows: readonly TaskSummaryRow[], today: string): TaskCounts {
  const counts: TaskCounts = { open: 0, today: 0, overdue: 0, noDue: 0, done: 0 };
  for (const row of rows) {
    if (row.status === 'done') counts.done += 1;
    if (row.status !== 'open') continue;
    counts.open += 1;
    const due = classifyDue(row.dueOn, 'open', today);
    if (due === 'overdue') counts.overdue += 1;
    else if (due === 'today') counts.today += 1;
    else if (due === 'none') counts.noDue += 1;
  }
  return counts;
}
