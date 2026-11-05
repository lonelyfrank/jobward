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
