import { describe, expect, it } from 'vitest';
import {
  anchorBefore,
  appendPosition,
  applyPlacement,
  placeAfter,
  POSITION_GAP,
  sortPositioned,
  type Positioned,
} from './ordering';

const item = (id: string, position: number): Positioned => ({ id, position });
const ids = (list: readonly Positioned[]) => list.map((i) => i.id);

describe('appendPosition', () => {
  it('parte da un gap in una lista vuota e accoda dopo il massimo', () => {
    expect(appendPosition(null)).toBe(POSITION_GAP);
    expect(appendPosition(3072)).toBe(3072 + POSITION_GAP);
  });
});

describe('placeAfter', () => {
  const list = [item('a', 1024), item('b', 2048), item('c', 3072)];

  it('inserimento iniziale in lista vuota', () => {
    expect(placeAfter([], null)).toEqual({ kind: 'ok', position: POSITION_GAP, rebalance: false });
  });

  it('in cima: prima del primo, senza ribilanciare', () => {
    const p = placeAfter(list, null);
    expect(p).toMatchObject({ kind: 'ok', rebalance: false });
    if (p.kind === 'ok') expect(p.position).toBeLessThan(1024);
  });

  it('in fondo: dopo l’ultimo', () => {
    expect(placeAfter(list, 'c')).toEqual({ kind: 'ok', position: 4096, rebalance: false });
  });

  it('tra due elementi: punto medio', () => {
    expect(placeAfter(list, 'a')).toEqual({ kind: 'ok', position: 1536, rebalance: false });
  });

  it('inserire ripetutamente in cima non esaurisce mai il gap (posizioni anche negative)', () => {
    let current = list;
    for (let i = 0; i < 50; i++) {
      const next = applyPlacement(current, item(`n${i}`, 0), null)!;
      expect(next[0]!.id).toBe(`n${i}`);
      current = next;
    }
  });

  it('ancora inesistente: segnalata, non ignorata', () => {
    expect(placeAfter(list, 'zzz')).toEqual({ kind: 'anchor_not_found' });
  });

  it('gap esaurito: ribilancia e colloca nel punto corretto', () => {
    const tight = [item('a', 10), item('b', 11), item('c', 12)];
    const p = placeAfter(tight, 'a');
    expect(p.kind).toBe('ok');
    if (p.kind !== 'ok' || !p.rebalance) throw new Error('atteso ribilanciamento');
    expect(p.rebalanced).toEqual([item('a', 1024), item('b', 2048), item('c', 3072)]);
    expect(p.position).toBe(1536);
  });

  it('posizioni duplicate: ribilancia e produce un ordine totale', () => {
    const dup = [item('a', 5), item('b', 5), item('c', 5)];
    const result = applyPlacement(dup, item('x', 0), 'b')!;
    expect(ids(result)).toEqual(['a', 'b', 'x', 'c']);
    expect(new Set(result.map((i) => i.position)).size).toBe(4);
  });

  it('i duplicati si ordinano per id, in modo deterministico', () => {
    expect(ids(sortPositioned([item('b', 1), item('a', 1), item('c', 0)]))).toEqual([
      'c',
      'a',
      'b',
    ]);
  });
});

describe('applyPlacement — proprietà', () => {
  it('dopo qualunque sequenza di spostamenti le posizioni restano distinte e l’ordine è quello richiesto', () => {
    // Generatore pseudo-casuale deterministico (nessuna dipendenza dall'orologio).
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };

    let order = Array.from({ length: 8 }, (_, i) => item(`i${i}`, (i + 1) * POSITION_GAP));
    const expected = order.map((o) => o.id);

    for (let step = 0; step < 400; step++) {
      const moved = order[rand(order.length)]!;
      const siblings = order.filter((o) => o.id !== moved.id);
      const afterIndex = rand(siblings.length + 1) - 1; // -1 = in cima
      const afterId = afterIndex < 0 ? null : siblings[afterIndex]!.id;

      const next = applyPlacement(siblings, moved, afterId)!;

      const model = expected.filter((id) => id !== moved.id);
      model.splice(afterIndex + 1, 0, moved.id);
      expected.splice(0, expected.length, ...model);

      expect(ids(next)).toEqual(expected);
      expect(new Set(next.map((n) => n.position)).size).toBe(next.length);
      order = next;
    }
  });
});

describe('anchorBefore', () => {
  it('restituisce il predecessore, o null per il primo', () => {
    const list = [item('a', 1), item('b', 2), item('c', 3)];
    expect(anchorBefore(list, 'b')).toBe('a');
    expect(anchorBefore(list, 'a')).toBeNull();
    expect(anchorBefore(list, 'assente')).toBeNull();
  });
});
