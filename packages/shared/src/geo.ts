/**
 * Distanze geografiche per la mappa delle opportunità (D-07, ADR-0016 D7).
 *
 * Solo calcoli locali e deterministici: nessun provider esterno, nessun geocoding, nessun routing.
 * Le coordinate sono sempre inserite o confermate dall'utente; un luogo senza coordinate resta
 * «non localizzabile» e viene comunque conteggiato. La distanza è **in linea d'aria**, non un
 * tempo o un percorso di viaggio.
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Raggio terrestre medio (IUGG), in km. */
export const EARTH_MEAN_RADIUS_KM = 6371.0088;

export function isValidGeoPoint(point: GeoPoint | null | undefined): point is GeoPoint {
  if (!point) return false;
  const { latitude, longitude } = point;
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Distanza in linea d'aria (formula dell'emisenoverso), in km. */
export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  if (!isValidGeoPoint(from) || !isValidGeoPoint(to)) {
    throw new RangeError('Coordinate non valide');
  }
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_MEAN_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const metres = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const whole = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' });

/** «850 m» sotto 1 km (a 10 m), «4,2 km» sotto 10 km, «23 km» oltre. */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) throw new RangeError('Distanza non valida');
  if (km < 1) {
    const rounded = Math.round((km * 1000) / 10) * 10;
    return rounded >= 1000 ? '1,0 km' : `${metres.format(rounded)} m`;
  }
  if (km < 10) {
    const rounded = Math.round(km * 10) / 10;
    return rounded >= 10 ? '10 km' : `${oneDecimal.format(rounded)} km`;
  }
  return `${whole.format(Math.round(km))} km`;
}

const NUMBER = '[-+]?\\d{1,3}(?:[.,]\\d+)?';
const PAIR_PATTERNS = [
  // Collegamenti delle app di mappe: «@45.46,9.19,15z», «!3d45.46!4d9.19», «?q=45.46,9.19», «ll=…».
  new RegExp(`!3d(${NUMBER})!4d(${NUMBER})`),
  new RegExp(`@(${NUMBER}),(${NUMBER})`),
  new RegExp(`[?&](?:q|query|ll|center|mlat)=(${NUMBER})(?:,|%2C|&mlon=)(${NUMBER})`, 'i'),
];

function toNumber(value: string): number {
  return Number(value.replace(',', '.'));
}

/**
 * Legge le coordinate incollate dall'utente: «45.4642, 9.1900», «45,4642; 9,1900»,
 * «45.4642 9.1900» o un collegamento di un'app di mappe che le contiene. Nessuna richiesta di rete:
 * se il testo non contiene una coppia valida restituisce `null`.
 */
export function parseCoordinates(input: string): GeoPoint | null {
  const text = input.trim();
  if (!text) return null;

  for (const pattern of PAIR_PATTERNS) {
    const match = pattern.exec(text);
    if (match?.[1] && match[2]) {
      const point = { latitude: toNumber(match[1]), longitude: toNumber(match[2]) };
      return isValidGeoPoint(point) ? point : null;
    }
  }

  // Coppia semplice: con la virgola decimale il separatore deve essere «;» o uno spazio.
  const plain =
    /^([-+]?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*([-+]?\d{1,3}(?:\.\d+)?)$/.exec(text) ??
    /^([-+]?\d{1,3}(?:,\d+)?)\s*(?:;|\s)\s*([-+]?\d{1,3}(?:,\d+)?)$/.exec(text);
  if (!plain?.[1] || !plain[2]) return null;
  const point = { latitude: toNumber(plain[1]), longitude: toNumber(plain[2]) };
  return isValidGeoPoint(point) ? point : null;
}

export interface RankedByDistance<T> {
  /** Elementi con coordinate, dal più vicino al più lontano (a parità, ordine originale). */
  located: Array<{ item: T; km: number }>;
  /** Elementi senza coordinate valide: «non localizzabili», mai scartati in silenzio. */
  unlocated: T[];
}

/** Ordina gli elementi per distanza da `origin`; quelli senza posizione restano conteggiati a parte. */
export function rankByDistance<T>(
  origin: GeoPoint,
  items: readonly T[],
  pointOf: (item: T) => GeoPoint | null | undefined,
): RankedByDistance<T> {
  if (!isValidGeoPoint(origin)) throw new RangeError('Coordinate di partenza non valide');
  const located: Array<{ item: T; km: number; index: number }> = [];
  const unlocated: T[] = [];
  items.forEach((item, index) => {
    const point = pointOf(item);
    if (isValidGeoPoint(point)) located.push({ item, km: distanceKm(origin, point), index });
    else unlocated.push(item);
  });
  located.sort((a, b) => a.km - b.km || a.index - b.index);
  return { located: located.map(({ item, km }) => ({ item, km })), unlocated };
}

export interface DistanceSummary {
  /** Opportunità con coordinate, su cui sono calcolati i valori. */
  count: number;
  /** Media aritmetica, mediana, minimo e massimo in km; `null` se non c'è alcun punto. */
  averageKm: number | null;
  medianKm: number | null;
  minKm: number | null;
  maxKm: number | null;
}

/** Riepilogo delle distanze in linea d'aria da `origin`: i punti non validi sono esclusi (e contati a parte da chi chiama). */
export function summarizeDistances(
  origin: GeoPoint,
  points: readonly (GeoPoint | null | undefined)[],
): DistanceSummary {
  if (!isValidGeoPoint(origin)) throw new RangeError('Coordinate di partenza non valide');
  const km = points
    .filter(isValidGeoPoint)
    .map((point) => distanceKm(origin, point))
    .sort((a, b) => a - b);
  if (km.length === 0) {
    return { count: 0, averageKm: null, medianKm: null, minKm: null, maxKm: null };
  }
  const middle = Math.floor(km.length / 2);
  return {
    count: km.length,
    averageKm: km.reduce((sum, value) => sum + value, 0) / km.length,
    medianKm: km.length % 2 === 1 ? km[middle]! : (km[middle - 1]! + km[middle]!) / 2,
    minKm: km[0]!,
    maxKm: km[km.length - 1]!,
  };
}

/** Coordinate da mostrare e da modificare: «45.4642, 9.19» (punto decimale, al più 6 cifre ≈ 0,1 m). */
export function formatCoordinates(point: GeoPoint): string {
  const fixed = (value: number) => String(Number(value.toFixed(6)));
  return `${fixed(point.latitude)}, ${fixed(point.longitude)}`;
}
