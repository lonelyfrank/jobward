import type { OpportunityMapItem, Place } from '@jobward/schemas';
import {
  distanceKm,
  isValidGeoPoint,
  summarizeDistances,
  type DistanceSummary,
  type GeoPoint,
} from '@jobward/shared';

/** Funzioni pure della vista Mappa (D-07): nessuno stato, testate senza interfaccia. */

export type LocatedItem = OpportunityMapItem & { latitude: number; longitude: number };

export const pointOf = (item: { latitude: number | null; longitude: number | null }) =>
  item.latitude !== null && item.longitude !== null
    ? { latitude: item.latitude, longitude: item.longitude }
    : null;

export function splitByLocation(items: readonly OpportunityMapItem[]) {
  const located: LocatedItem[] = [];
  const unlocated: OpportunityMapItem[] = [];
  for (const item of items) {
    if (isValidGeoPoint(pointOf(item))) located.push(item as LocatedItem);
    else unlocated.push(item);
  }
  return { located, unlocated };
}

/** Opportunità nello stesso punto (≈ 10 m) diventano un unico segnaposto con il loro numero. */
export interface MapGroup {
  key: string;
  point: GeoPoint;
  items: LocatedItem[];
}

export function groupByPoint(items: readonly LocatedItem[]): MapGroup[] {
  const groups = new Map<string, MapGroup>();
  for (const item of items) {
    const key = `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`;
    const group = groups.get(key);
    if (group) group.items.push(item);
    else
      groups.set(key, {
        key,
        point: { latitude: item.latitude, longitude: item.longitude },
        items: [item],
      });
  }
  return [...groups.values()];
}

export interface PlaceSummary {
  place: Place;
  summary: DistanceSummary;
}

/** Media, mediana, minimo e massimo per ciascuna posizione dell'utente (casa per prima). */
export function summarizeByPlace(
  places: readonly Place[],
  located: readonly LocatedItem[],
): PlaceSummary[] {
  const points = located.map(pointOf);
  return places.map((place) => ({ place, summary: summarizeDistances(place, points) }));
}

export interface DistanceRow {
  item: LocatedItem;
  /** Distanze in km nello stesso ordine di `places`. */
  km: number[];
}

/** Righe dell'elenco accessibile, ordinate per distanza dalla posizione di riferimento. */
export function distanceRows(
  located: readonly LocatedItem[],
  places: readonly Place[],
  referenceIndex: number,
): DistanceRow[] {
  const rows = located.map((item) => ({
    item,
    km: places.map((place) => distanceKm(place, item)),
  }));
  if (places.length === 0) {
    return rows.sort((a, b) => a.item.title.localeCompare(b.item.title, 'it'));
  }
  return rows.sort(
    (a, b) =>
      (a.km[referenceIndex] ?? 0) - (b.km[referenceIndex] ?? 0) ||
      a.item.title.localeCompare(b.item.title, 'it'),
  );
}

/** Inquadratura: centro (unità della mappa) e fattore di zoom (1 = tutta la larghezza). */
export interface MapView {
  cx: number;
  cy: number;
  k: number;
}

/**
 * Riquadro in cui si disegna: dimensioni della mappa incorporata e proporzioni REALI del contenitore
 * (altezza / larghezza in pixel). Il riquadro segue lo spazio della pagina, non la forma della mappa.
 */
export interface MapFrame {
  width: number;
  height: number;
  aspect: number;
}

/** Zoom massimo: circa 1 km di larghezza, scala di quartiere (tile di OpenStreetMap fino al livello 18). */
export const MAX_ZOOM = 6000;

/** Zoom minimo: l'intera mappa sta nel riquadro, qualunque sia la sua forma. */
export const minZoom = (frame: MapFrame) =>
  Math.min(1, (frame.width * frame.aspect) / frame.height);

export const clampZoom = (k: number, frame: MapFrame) =>
  Math.min(MAX_ZOOM, Math.max(minZoom(frame), k));

/** Rettangolo visibile (viewBox) in unità della mappa. */
export function viewBox(view: MapView, frame: MapFrame) {
  const w = frame.width / view.k;
  const h = w * frame.aspect;
  return { x: view.cx - w / 2, y: view.cy - h / 2, w, h };
}

/** Il centro resta sulla mappa: non si può trascinare l'Europa fuori dallo schermo. */
export function clampView(view: MapView, frame: MapFrame): MapView {
  return {
    k: clampZoom(view.k, frame),
    cx: Math.min(frame.width, Math.max(0, view.cx)),
    cy: Math.min(frame.height, Math.max(0, view.cy)),
  };
}

/** Inquadratura che contiene tutti i punti con un margine; un solo punto → vista di città (~25 km). */
export function fitView(points: readonly { x: number; y: number }[], frame: MapFrame): MapView {
  if (points.length === 0) {
    return { cx: frame.width / 2, cy: frame.height / 2, k: minZoom(frame) };
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const k =
    spanX === 0 && spanY === 0
      ? 200
      : Math.min(
          spanX > 0 ? frame.width / (spanX * 1.4) : Infinity,
          spanY > 0 ? (frame.width * frame.aspect) / (spanY * 1.4) : Infinity,
        );
  return clampView({ cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, k }, frame);
}

/** Zoom intorno a un punto dello schermo (frazioni 0–1 del riquadro) che resta fermo. */
export function zoomAt(
  view: MapView,
  factor: number,
  fx: number,
  fy: number,
  frame: MapFrame,
): MapView {
  const before = viewBox(view, frame);
  const px = before.x + fx * before.w;
  const py = before.y + fy * before.h;
  const k = clampZoom(view.k * factor, frame);
  const after = viewBox({ ...view, k }, frame);
  return clampView(
    { k, cx: px - fx * after.w + after.w / 2, cy: py - fy * after.h + after.h / 2 },
    frame,
  );
}

/**
 * Raggruppa i segnaposto troppo vicini SULLO SCHERMO (entro `threshold` pixel), in modo greedy e
 * deterministico: a scala europea le opportunità di una stessa città diventano un solo segnaposto
 * con il loro numero; ingrandendo si separano.
 */
export function clusterOnScreen<T extends { sx: number; sy: number }>(
  points: readonly T[],
  threshold: number,
): T[][] {
  const clusters: { sx: number; sy: number; members: T[] }[] = [];
  for (const point of points) {
    const near = clusters.find((c) => Math.hypot(c.sx - point.sx, c.sy - point.sy) <= threshold);
    if (near) {
      near.members.push(point);
      // Il centro segue la media dei membri, così il gruppo resta dove sono i punti.
      near.sx += (point.sx - near.sx) / near.members.length;
      near.sy += (point.sy - near.sy) / near.members.length;
    } else {
      clusters.push({ sx: point.sx, sy: point.sy, members: [point] });
    }
  }
  return clusters.map((c) => c.members);
}

export interface CompanyOffers<T> {
  /** `null` = azienda non indicata (sempre per ultima). */
  company: string | null;
  items: T[];
}

/**
 * Offerte raggruppate per azienda per la scheda al passaggio del mouse: l'azienda sempre in testa,
 * sotto le sue offerte. Aziende in ordine alfabetico (italiano), senza distinzione di maiuscole.
 */
export function groupByCompany<T extends { company: string | null; title: string }>(
  items: readonly T[],
): CompanyOffers<T>[] {
  const groups = new Map<string, CompanyOffers<T>>();
  for (const item of items) {
    const name = item.company?.trim() || null;
    const key = name?.toLocaleLowerCase('it') ?? '\u0000none';
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, { company: name, items: [item] });
  }
  const collator = new Intl.Collator('it', { sensitivity: 'base' });
  return [...groups.values()]
    .map((g) => ({ ...g, items: [...g.items].sort((a, b) => collator.compare(a.title, b.title)) }))
    .sort((a, b) =>
      a.company === null ? 1 : b.company === null ? -1 : collator.compare(a.company, b.company),
    );
}
