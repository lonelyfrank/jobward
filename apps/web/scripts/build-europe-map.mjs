// Genera i confini europei incorporati nella vista Mappa (D-07, ADR-0019).
//
// Fonte: Natural Earth 1:50m (pubblico dominio) tramite `world-atlas` (ISC), solo dipendenza di
// sviluppo. Le forme sono proiettate UNA volta qui in **Web Mercator** (EPSG:3857, la stessa
// proiezione delle tile di OpenStreetMap, così confini, tile e segnaposto coincidono), ritagliate
// sul riquadro della mappa e scritte come percorsi SVG. I confini restano visibili anche senza
// rete o con lo stradario spento: nessun dato cartografico viene scaricato per disegnarli.
//
// Uso: node apps/web/scripts/build-europe-map.mjs  (riscrive src/features/opportunities/map/europe-map.json)
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const webRoot = path.resolve(import.meta.dirname, '..');
const topology = require('world-atlas/countries-50m.json');
const atlasVersion = require('world-atlas/package.json').version;
const output = path.join(webRoot, 'src/features/opportunities/map/europe-map.json');

// Proiezione: DEVE coincidere con `projectPoint` in map/projection.ts (verificato da un test).
// Coordinate "mondo" normalizzate 0–1, y verso il basso, come lo schema delle tile XYZ.
const MAX_LAT = 85.05112878;
function mercator(lon, lat) {
  const phi = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  return [(lon + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2];
}

// Copertura: almeno l'Europa (Islanda, Capo Nord, Cipro, Caucaso, Mosca).
const LON_MIN = -25;
const LON_MAX = 45;
const LAT_MIN = 34;
const LAT_MAX = 72;
const [minX, minY] = mercator(LON_MIN, LAT_MAX);
const [maxX, maxY] = mercator(LON_MAX, LAT_MIN);

const WIDTH = 1000;
const scale = WIDTH / (maxX - minX);
const HEIGHT = Math.round((maxY - minY) * scale);
/** Coordinate del viewBox (y verso il basso). */
const toScreen = ([x, y]) => [(x - minX) * scale, (y - minY) * scale];

// Ritaglio (Sutherland–Hodgman) su un riquadro poco più grande della mappa: i lati tagliati
// cadono fuori dal viewBox e non si vedono.
const MARGIN = 40;
const CLIP = { x0: -MARGIN, y0: -MARGIN, x1: WIDTH + MARGIN, y1: HEIGHT + MARGIN };
function clipRing(points) {
  const edges = [
    (p) => p[0] >= CLIP.x0,
    (p) => p[0] <= CLIP.x1,
    (p) => p[1] >= CLIP.y0,
    (p) => p[1] <= CLIP.y1,
  ];
  const cut = [
    (a, b) => lerpAt(a, b, 0, CLIP.x0),
    (a, b) => lerpAt(a, b, 0, CLIP.x1),
    (a, b) => lerpAt(a, b, 1, CLIP.y0),
    (a, b) => lerpAt(a, b, 1, CLIP.y1),
  ];
  let ring = points;
  for (let e = 0; e < 4 && ring.length > 0; e++) {
    const inside = edges[e];
    const next = [];
    for (let i = 0; i < ring.length; i++) {
      const current = ring[i];
      const previous = ring[(i + ring.length - 1) % ring.length];
      if (inside(current)) {
        if (!inside(previous)) next.push(cut[e](previous, current));
        next.push(current);
      } else if (inside(previous)) {
        next.push(cut[e](previous, current));
      }
    }
    ring = next;
  }
  return ring;
}
function lerpAt(a, b, axis, value) {
  const t = (value - a[axis]) / (b[axis] - a[axis]);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

const area = (ring) => {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
};

// Percorso compatto: un decimale (≈ 0,5 km), comandi relativi, punti ripetuti eliminati.
const num = (value) => {
  const text = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '');
  return text === '-0' ? '0' : text;
};
function ringPath(ring) {
  const rounded = [];
  for (const [x, y] of ring) {
    const p = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
    const last = rounded[rounded.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) rounded.push(p);
  }
  if (rounded.length < 3) return '';
  let d = `M${num(rounded[0][0])} ${num(rounded[0][1])}l`;
  for (let i = 1; i < rounded.length; i++) {
    const dx = num(rounded[i][0] - rounded[i - 1][0]);
    const dy = num(rounded[i][1] - rounded[i - 1][1]);
    d += `${i === 1 || dx.startsWith('-') ? '' : ' '}${dx}${dy.startsWith('-') ? '' : ' '}${dy}`;
  }
  return `${d}z`;
}

const MIN_AREA = 0.3; // unità² del viewBox (≈ 8 km²): isolotti invisibili a ogni zoom utile.
const countries = [];
for (const country of feature(topology, topology.objects.countries).features) {
  const polygons =
    country.geometry?.type === 'Polygon'
      ? [country.geometry.coordinates]
      : country.geometry?.type === 'MultiPolygon'
        ? country.geometry.coordinates
        : [];
  let d = '';
  for (const polygon of polygons) {
    for (const ring of polygon) {
      // Le parti sull'altro lato del globo non servono (e la proiezione le stira).
      if (ring.every(([lon, lat]) => lon < -60 || lon > 100 || lat < 15)) continue;
      const clipped = clipRing(ring.map(([lon, lat]) => toScreen(mercator(lon, lat))));
      if (clipped.length < 3 || area(clipped) < MIN_AREA) continue;
      d += ringPath(clipped);
    }
  }
  if (d) countries.push({ id: String(country.id ?? ''), d });
}
countries.sort((a, b) => a.id.localeCompare(b.id));

const result = {
  source: `Natural Earth 1:50m (pubblico dominio), world-atlas ${atlasVersion}`,
  projection: { kind: 'webmercator', minX, minY, scale },
  width: WIDTH,
  height: HEIGHT,
  countries,
};
fs.writeFileSync(output, `${JSON.stringify(result)}\n`);
console.log(
  `europe-map.json: ${countries.length} paesi, ${(fs.statSync(output).size / 1024).toFixed(0)} KB`,
);
