import type { GeoPoint } from '@jobward/shared';

/**
 * Proiezione della mappa (D-07, ADR-0019): Web Mercator (EPSG:3857), la stessa delle tile di
 * OpenStreetMap, così confini incorporati, tile e segnaposto coincidono. I parametri vengono da
 * `europe-map.json` (generato da scripts/build-europe-map.mjs): nessuna libreria cartografica.
 *
 * Coordinate «mondo» normalizzate 0–1 con y verso il basso (schema delle tile XYZ); il viewBox
 * della mappa è `(mondo − min) × scale`.
 */
export interface MapProjection {
  kind: string;
  minX: number;
  minY: number;
  scale: number;
}

export interface MapAsset {
  source: string;
  projection: MapProjection;
  width: number;
  height: number;
  countries: { id: string; d: string }[];
}

const MAX_LAT = 85.05112878;

/** Punto geografico → coordinate mondo normalizzate (0–1). */
export function toWorld(point: GeoPoint): { x: number; y: number } {
  const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, point.latitude));
  const phi = (lat * Math.PI) / 180;
  return {
    x: (point.longitude + 180) / 360,
    y: (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2,
  };
}

/** Punto geografico → coordinate del viewBox della mappa. */
export function projectPoint(projection: MapProjection, point: GeoPoint): { x: number; y: number } {
  const world = toWorld(point);
  return {
    x: (world.x - projection.minX) * projection.scale,
    y: (world.y - projection.minY) * projection.scale,
  };
}

export interface Tile {
  z: number;
  x: number;
  y: number;
  /** Posizione e lato nel viewBox della mappa. */
  left: number;
  top: number;
  size: number;
}

export const TILE_MIN_ZOOM = 3;
export const TILE_MAX_ZOOM = 19;

/**
 * Livello di tile adatto alla scala: un tile da 256 px deve occupare circa 256 px sullo schermo.
 * `unitsPerPixel` = unità del viewBox per pixel dello schermo.
 */
export function tileZoom(projection: MapProjection, unitsPerPixel: number): number {
  if (!(unitsPerPixel > 0)) return TILE_MIN_ZOOM;
  const z = Math.round(Math.log2(projection.scale / (256 * unitsPerPixel)));
  return Math.min(TILE_MAX_ZOOM, Math.max(TILE_MIN_ZOOM, z));
}

/** Tile del livello `z` che coprono il rettangolo visibile (in unità del viewBox). */
export function visibleTiles(
  projection: MapProjection,
  box: { x: number; y: number; w: number; h: number },
  z: number,
): Tile[] {
  const n = 2 ** z;
  const size = projection.scale / n;
  const toTile = (units: number, min: number) => Math.floor((units / projection.scale + min) * n);
  const clampTile = (t: number) => Math.min(n - 1, Math.max(0, t));
  const x0 = clampTile(toTile(box.x, projection.minX));
  const x1 = clampTile(toTile(box.x + box.w, projection.minX));
  const y0 = clampTile(toTile(box.y, projection.minY));
  const y1 = clampTile(toTile(box.y + box.h, projection.minY));
  const tiles: Tile[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      tiles.push({
        z,
        x,
        y,
        left: (x / n - projection.minX) * projection.scale,
        top: (y / n - projection.minY) * projection.scale,
        size,
      });
    }
  }
  return tiles;
}

/** Indirizzo di un tile dello stradario standard di OpenStreetMap (attribuzione obbligatoria). */
export const osmTileUrl = (tile: Pick<Tile, 'z' | 'x' | 'y'>) =>
  `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`;
