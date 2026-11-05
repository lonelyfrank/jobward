/**
 * Date dei colloqui: l'istante è UTC (ms), l'utente lo scrive e lo legge in un fuso IANA.
 * Funzioni pure e testate (nessuna dipendenza esterna): conversione «ora locale nel fuso» ↔ istante.
 */

const PARTS = ['year', 'month', 'day', 'hour', 'minute', 'second'] as const;

/** Scarto (ms) del fuso rispetto a UTC all'istante dato: positivo a est di Greenwich. */
export function zoneOffsetMs(instant: number, timeZone: string): number {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const v: Record<string, number> = {};
  for (const part of f.formatToParts(new Date(instant))) {
    if ((PARTS as readonly string[]).includes(part.type)) v[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(
    v['year']!,
    v['month']! - 1,
    v['day'],
    v['hour'],
    v['minute'],
    v['second'],
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** `2026-11-10T15:30` (ora locale del fuso) → istante UTC; `null` se il formato non è valido. */
export function localInputToInstant(local: string, timeZone: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(guess)) return null;
  // Due passaggi: l'offset dipende dall'istante, e vicino ai cambi d'ora il primo tentativo può sbagliare.
  const first = guess - zoneOffsetMs(guess, timeZone);
  return guess - zoneOffsetMs(first, timeZone);
}

/** Istante UTC → `YYYY-MM-DDTHH:mm` nel fuso, per `<input type="datetime-local">`. */
export function instantToLocalInput(instant: number, timeZone: string): string {
  const shifted = new Date(instant + zoneOffsetMs(instant, timeZone));
  return shifted.toISOString().slice(0, 16);
}

/** Data e ora leggibili nel fuso del colloquio, con la sigla del fuso se diverso da quello mostrato. */
export function formatInterviewDate(
  instant: number,
  timeZone: string | null,
  displayZone: string,
  options: { short?: boolean } = {},
): string {
  const zone = timeZone ?? displayZone;
  const text = new Intl.DateTimeFormat('it-IT', {
    timeZone: zone,
    ...(options.short
      ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
      : {
          weekday: 'short',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
  }).format(new Date(instant));
  return zone === displayZone ? text : `${text} (${zone})`;
}

/** Fusi disponibili nel browser, con quello indicato sempre presente in testa. */
export function timeZoneOptions(current: string): string[] {
  let all: string[] = [];
  try {
    all =
      (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.(
        'timeZone',
      ) ?? [];
  } catch {
    all = [];
  }
  return [current, ...all.filter((z) => z !== current)];
}
