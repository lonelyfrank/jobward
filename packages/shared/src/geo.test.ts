import { describe, expect, it } from 'vitest';
import {
  distanceKm,
  formatDistance,
  isValidGeoPoint,
  parseCoordinates,
  rankByDistance,
} from './geo';

const duomo = { latitude: 45.4642, longitude: 9.19 };
const colosseo = { latitude: 41.8902, longitude: 12.4922 };

describe('distanceKm', () => {
  it('calcola la distanza in linea d’aria con il raggio medio', () => {
    expect(distanceKm(duomo, colosseo)).toBeCloseTo(477.877, 2);
    expect(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(
      111.195,
      2,
    );
    expect(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 })).toBeCloseTo(
      20015.114,
      2,
    );
  });

  it('è zero sullo stesso punto ed è simmetrica', () => {
    expect(distanceKm(duomo, duomo)).toBe(0);
    expect(distanceKm(duomo, colosseo)).toBeCloseTo(distanceKm(colosseo, duomo), 9);
  });

  it('rifiuta coordinate fuori intervallo', () => {
    expect(() => distanceKm({ latitude: 91, longitude: 0 }, duomo)).toThrow(RangeError);
    expect(() => distanceKm(duomo, { latitude: 0, longitude: Number.NaN })).toThrow(RangeError);
  });
});

describe('isValidGeoPoint', () => {
  it('accetta i limiti e scarta il resto', () => {
    expect(isValidGeoPoint({ latitude: -90, longitude: 180 })).toBe(true);
    expect(isValidGeoPoint({ latitude: 0, longitude: -180.0001 })).toBe(false);
    expect(isValidGeoPoint(null)).toBe(false);
    expect(isValidGeoPoint(undefined)).toBe(false);
  });
});

describe('formatDistance', () => {
  it('usa metri, un decimale o interi secondo la scala', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(0.8812)).toBe('880 m');
    expect(formatDistance(0.9996)).toBe('1,0 km');
    expect(formatDistance(4.24)).toBe('4,2 km');
    expect(formatDistance(9.97)).toBe('10 km');
    expect(formatDistance(477.877)).toBe('478 km');
    expect(formatDistance(1234.4)).toBe('1.234 km');
  });

  it('rifiuta valori negativi o non finiti', () => {
    expect(() => formatDistance(-1)).toThrow(RangeError);
    expect(() => formatDistance(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('parseCoordinates', () => {
  it.each([
    ['45.4642, 9.19', duomo],
    ['45.4642 9.19', duomo],
    ['45.4642,9.19', duomo],
    ['45,4642; 9,19', duomo],
    ['45,4642 9,19', duomo],
    ['  -33.8688, 151.2093 ', { latitude: -33.8688, longitude: 151.2093 }],
  ])('legge la coppia «%s»', (input, expected) => {
    expect(parseCoordinates(input)).toEqual(expected);
  });

  it.each([
    ['https://www.google.com/maps/place/Duomo/@45.4642,9.19,17z/data=x', duomo],
    ['https://www.google.com/maps/place/x/data=!3d45.4642!4d9.19', duomo],
    ['https://maps.apple.com/?ll=45.4642,9.19&q=Duomo', duomo],
    ['https://www.openstreetmap.org/?mlat=45.4642&mlon=9.19#map=17/45.4642/9.19', duomo],
    ['geo:45.4642,9.19?q=45.4642,9.19', duomo],
  ])('legge le coordinate dal collegamento %s', (input, expected) => {
    expect(parseCoordinates(input)).toEqual(expected);
  });

  it.each(['', 'Via Solferino, Milano', '95.1, 9.19', '45.4642', 'abc, def', '45.46, 9.19, 3'])(
    'restituisce null per «%s»',
    (input) => {
      expect(parseCoordinates(input)).toBeNull();
    },
  );
});

describe('rankByDistance', () => {
  const items = [
    { name: 'Roma', point: colosseo },
    { name: 'Senza sede', point: null },
    { name: 'Brera', point: { latitude: 45.472, longitude: 9.188 } },
    { name: 'Duomo', point: duomo },
    { name: 'Errata', point: { latitude: 200, longitude: 0 } },
  ];

  it('ordina dal più vicino e conserva i non localizzabili', () => {
    const result = rankByDistance(duomo, items, (item) => item.point);
    expect(result.located.map(({ item }) => item.name)).toEqual(['Duomo', 'Brera', 'Roma']);
    expect(result.located[1]?.km).toBeCloseTo(0.881, 3);
    expect(result.unlocated.map((item) => item.name)).toEqual(['Senza sede', 'Errata']);
    expect(result.located.length + result.unlocated.length).toBe(items.length);
  });

  it('a parità di distanza mantiene l’ordine originale', () => {
    const twins = [
      { name: 'A', point: duomo },
      { name: 'B', point: duomo },
    ];
    const result = rankByDistance(colosseo, twins, (item) => item.point);
    expect(result.located.map(({ item }) => item.name)).toEqual(['A', 'B']);
  });

  it('rifiuta un punto di partenza non valido', () => {
    expect(() =>
      rankByDistance({ latitude: Number.NaN, longitude: 0 }, items, (i) => i.point),
    ).toThrow(RangeError);
  });
});
