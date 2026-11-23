/** Formattazione di date nel fuso orario del workspace. Gli istanti sono sempre UTC in input. */
export function formatDateTime(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(ms));
}

export function greetingFor(date: Date, timeZone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone }).format(date),
  );
  if (hour >= 5 && hour < 13) return 'Buongiorno';
  if (hour >= 13 && hour < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

/**
 * Data di calendario `YYYY-MM-DD` → testo, SENZA conversione di fuso: è un giorno, non un istante
 * (la data di candidatura del 5 novembre resta il 5 novembre per chiunque la legga).
 */
export function formatCalendarDate(value: string | null): string | null {
  if (value === null) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/**
 * Istante → «2 ore fa», «ieri»… (entro 30 giorni); oltre, la data. `now` è iniettabile per i test.
 */
export function formatRelative(ms: number, timeZone: string, now = Date.now()): string {
  const seconds = (ms - now) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 60) return 'adesso';
  const rtf = new Intl.RelativeTimeFormat('it-IT', { numeric: 'auto' });
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86_400 * 30) return rtf.format(Math.round(seconds / 86_400), 'day');
  return `il ${new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeZone }).format(new Date(ms))}`;
}
