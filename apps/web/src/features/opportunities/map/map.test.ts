import type { OpportunityMapItem, Place } from '@jobward/schemas';
import { describe, expect, it } from 'vitest';
import europeMap from './europe-map.json';
import {
  clampView,
  clusterOnScreen,
  distanceRows,
  fitView,
  groupByCompany,
  groupByPoint,
  MAX_ZOOM,
  minZoom,
  splitByLocation,
  summarizeByPlace,
  viewBox,
  zoomAt,
} from './model';
import {
  osmTileUrl,
  projectPoint,
  TILE_MAX_ZOOM,
  TILE_MIN_ZOOM,
  tileZoom,
  toWorld,
  visibleTiles,
} from './projection';

const asset = europeMap;

const item = (
  id: string,
  latitude: number | null,
  longitude: number | null,
  over: Partial<OpportunityMapItem> = {},
): OpportunityMapItem => ({
  id,
  title: id,
  company: null,
  jobTitle: null,
  location: null,
  city: null,
  latitude,
  longitude,
  boardName: null,
  stage: null,
  outcome: null,
  archivedAt: null,
  ...over,
});

const place = (id: string, latitude: number, longitude: number, kind: Place['kind'] = 'other') => ({
  id,
  name: id,
  kind,
  latitude,
  longitude,
  position: 0,
  createdAt: 1,
  updatedAt: 1,
});

describe('proiezione dei confini incorporati', () => {
  it('usa Web Mercator come lo script e le tile, e tiene l’Europa nel riquadro', () => {
    expect(asset.projection.kind).toBe('webmercator');
    expect(asset.width).toBe(1000);
    for (const [lat, lon] of [
      [45.4642, 9.19], // Milano
      [64.1466, -21.9426], // Reykjavík
      [71.17, 25.78], // Capo Nord
      [35.17, 33.36], // Nicosia
      [55.75, 37.62], // Mosca
      [38.72, -9.14], // Lisbona
    ] as const) {
      const { x, y } = projectPoint(asset.projection, { latitude: lat, longitude: lon });
      expect(x, `${lat},${lon}`).toBeGreaterThan(0);
      expect(x).toBeLessThan(asset.width);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(asset.height);
    }
  });

  it('coordinate mondo e tile coincidono con lo schema XYZ di OpenStreetMap', () => {
    // Riferimento (formula del wiki di OpenStreetMap, asinh(tan φ)): Milano a zoom 10 → tile 538/366.
    const world = toWorld({ latitude: 45.4642, longitude: 9.19 });
    expect(Math.floor(world.x * 1024)).toBe(538);
    expect(Math.floor(world.y * 1024)).toBe(366);
    const milano = projectPoint(asset.projection, { latitude: 45.4642, longitude: 9.19 });
    // Riquadro piccolo (0,4 unità): Milano dista ~0,7 unità dal bordo sinistro della tile.
    const box = { x: milano.x - 0.2, y: milano.y - 0.2, w: 0.4, h: 0.4 };
    const tiles = visibleTiles(asset.projection, box, 10);
    expect(tiles.map((t) => `${t.z}/${t.x}/${t.y}`)).toEqual(['10/538/366']);
    const [tile] = tiles;
    expect(milano.x).toBeGreaterThanOrEqual(tile!.left);
    expect(milano.x).toBeLessThan(tile!.left + tile!.size);
    expect(osmTileUrl(tile!)).toBe('https://tile.openstreetmap.org/10/538/366.png');
  });

  it('livello delle tile: più si ingrandisce, più è alto, entro i limiti di OpenStreetMap', () => {
    const p = asset.projection;
    // Tutta l'Europa su ~1000 px → livello basso; un chilometro su ~800 px → livello di strada.
    expect(tileZoom(p, 1)).toBeLessThanOrEqual(5);
    expect(tileZoom(p, 0.0002)).toBeGreaterThanOrEqual(16);
    expect(tileZoom(p, 1e-9)).toBe(TILE_MAX_ZOOM);
    expect(tileZoom(p, 0)).toBe(TILE_MIN_ZOOM);
  });

  it('orientamento: Berlino è a nord-est di Milano, Lisbona a ovest', () => {
    const milano = projectPoint(asset.projection, { latitude: 45.4642, longitude: 9.19 });
    const berlino = projectPoint(asset.projection, { latitude: 52.52, longitude: 13.405 });
    const lisbona = projectPoint(asset.projection, { latitude: 38.72, longitude: -9.14 });
    expect(berlino.x).toBeGreaterThan(milano.x);
    expect(berlino.y).toBeLessThan(milano.y);
    expect(lisbona.x).toBeLessThan(milano.x);
  });

  it('dichiara la fonte dei dati e contiene i confini', () => {
    expect(asset.source).toMatch(/Natural Earth/);
    expect(asset.countries.length).toBeGreaterThan(40);
  });
});

describe('modello della mappa', () => {
  const items = [
    item('a', 45.4642, 9.19),
    item('b', null, null),
    item('c', 45.46421, 9.19001),
    item('d', 52.52, 13.405),
  ];

  it('separa le opportunità senza coordinate e raggruppa quelle nello stesso punto', () => {
    const { located, unlocated } = splitByLocation(items);
    expect(unlocated.map((i) => i.id)).toEqual(['b']);
    const groups = groupByPoint(located);
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([['a', 'c'], ['d']]);
  });

  it('ordina per distanza dalla posizione di riferimento e riassume ogni posizione', () => {
    const { located } = splitByLocation(items);
    const places = [place('Berlino', 52.52, 13.405, 'home'), place('Milano', 45.4642, 9.19)];
    // «c» è un metro più a nord-est di «a»: da Berlino è (di poco) più vicina.
    expect(distanceRows(located, places, 0).map((r) => r.item.id)).toEqual(['d', 'c', 'a']);
    expect(distanceRows(located, places, 1).map((r) => r.item.id)).toEqual(['a', 'c', 'd']);
    const [berlino] = summarizeByPlace(places, located);
    expect(berlino?.summary.count).toBe(3);
    expect(berlino?.summary.minKm).toBe(0);
    // Senza posizioni: ordine alfabetico, nessuna distanza.
    expect(distanceRows(located, [], 0).map((r) => r.km)).toEqual([[], [], []]);
  });

  const frame = { width: 1000, height: 700, aspect: 0.7 };

  it('inquadratura: tutta la mappa senza punti, vista di città con un punto solo, zoom limitato', () => {
    expect(fitView([], frame)).toEqual({ cx: 500, cy: 350, k: 1 });
    expect(fitView([{ x: 10, y: 20 }], frame)).toEqual({ cx: 10, cy: 20, k: 200 });
    const wide = fitView(
      [
        { x: 100, y: 100 },
        { x: 900, y: 600 },
      ],
      frame,
    );
    expect(wide.k).toBeLessThan(1.3);
    expect(clampView({ cx: -50, cy: 9999, k: 9999 }, frame)).toEqual({
      cx: 0,
      cy: 700,
      k: MAX_ZOOM,
    });
  });

  it('riquadro di forma diversa dalla mappa: l’intera mappa resta visibile e i punti ci stanno', () => {
    // Riquadro basso e largo: per vedere tutta l'altezza serve uno zoom minore di 1.
    const flat = { width: 1000, height: 700, aspect: 0.35 };
    expect(minZoom(flat)).toBeCloseTo(0.5, 6);
    expect(fitView([], flat).k).toBeCloseTo(0.5, 6);
    // Riquadro alto e stretto: la larghezza comanda.
    const tall = { width: 1000, height: 700, aspect: 1.5 };
    expect(minZoom(tall)).toBe(1);
    const view = fitView(
      [
        { x: 400, y: 300 },
        { x: 600, y: 320 },
      ],
      tall,
    );
    const box = viewBox(view, tall);
    expect(box.w / box.h).toBeCloseTo(1 / 1.5, 6);
    for (const p of [
      { x: 400, y: 300 },
      { x: 600, y: 320 },
    ]) {
      expect(p.x).toBeGreaterThan(box.x);
      expect(p.x).toBeLessThan(box.x + box.w);
      expect(p.y).toBeGreaterThan(box.y);
      expect(p.y).toBeLessThan(box.y + box.h);
    }
  });

  it('lo zoom intorno a un punto lo lascia fermo sullo schermo', () => {
    const view = { cx: 500, cy: 350, k: 2 };
    const before = viewBox(view, frame);
    const next = zoomAt(view, 2, 0.25, 0.75, frame);
    const after = viewBox(next, frame);
    expect(after.x + 0.25 * after.w).toBeCloseTo(before.x + 0.25 * before.w, 6);
    expect(after.y + 0.75 * after.h).toBeCloseTo(before.y + 0.75 * before.h, 6);
  });
});

describe('raggruppamento sullo schermo', () => {
  it('unisce i punti vicini in pixel e lascia separati quelli lontani', () => {
    const clusters = clusterOnScreen(
      [
        { id: 'a', sx: 100, sy: 100 },
        { id: 'b', sx: 110, sy: 105 },
        { id: 'c', sx: 300, sy: 100 },
        { id: 'd', sx: 104, sy: 98 },
      ],
      22,
    );
    expect(clusters.map((c) => c.map((p) => p.id))).toEqual([['a', 'b', 'd'], ['c']]);
    expect(clusterOnScreen([], 22)).toEqual([]);
  });
});

describe('scheda al passaggio del mouse', () => {
  it('raggruppa le offerte per azienda: azienda in testa, offerte sotto, senza azienda per ultime', () => {
    const groups = groupByCompany([
      item('a', 1, 1, { title: 'Sviluppatore', company: 'Beta' }),
      item('b', 1, 1, { title: 'Analista', company: 'alfa' }),
      item('c', 1, 1, { title: 'Tester', company: null }),
      item('d', 1, 1, { title: 'Architetto', company: 'Beta ' }),
      item('e', 1, 1, { title: 'Designer', company: 'Alfa' }),
    ]);
    expect(groups.map((g) => [g.company, g.items.map((i) => i.title)])).toEqual([
      ['alfa', ['Analista', 'Designer']],
      ['Beta', ['Architetto', 'Sviluppatore']],
      [null, ['Tester']],
    ]);
  });
});
