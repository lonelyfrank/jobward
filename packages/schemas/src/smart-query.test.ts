import { describe, expect, it } from 'vitest';
import { opportunitiesQuery } from './opportunity';
import {
  parseSmartQuery,
  smartQueryJson,
  smartQuerySchema,
  SMART_QUERY_MAX_JSON,
} from './smart-query';

const valid = {
  v: 2,
  where: {
    op: 'or',
    items: [
      { field: 'stage', op: 'in', value: ['applied'] },
      { field: 'company', op: 'contains', value: 'acme' },
    ],
  },
};

describe('smartQuerySchema', () => {
  it('accetta una query valida e la restituisce in forma canonica', () => {
    const parsed = smartQuerySchema.parse(valid);
    expect(parsed.v).toBe(2);
    expect(parseSmartQuery(valid)).toEqual(parsed);
    expect(
      parseSmartQuery({ v: 2, where: { field: 'stage', op: 'in', value: ['saved', 'saved'] } }),
    ).toBeNull(); // duplicati
  });

  it('gli errori portano il percorso e il messaggio del validatore condiviso', () => {
    const result = smartQuerySchema.safeParse({
      v: 2,
      where: { op: 'and', items: [{ field: 'stage', op: 'in', value: ['bogus'] }] },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.path).toEqual(['where', 'items', '0']);
      expect(result.error.issues[0]!.message).toMatch(/vocabolario/);
    }
  });

  it('non lancia mai su input ostili', () => {
    for (const input of [
      null,
      undefined,
      1,
      'x',
      [],
      {},
      { v: 2, where: [] },
      { v: 2, where: { items: null } },
    ]) {
      expect(() => parseSmartQuery(input)).not.toThrow();
    }
    expect(parseSmartQuery(undefined)).toBeNull();
  });
});

describe('smartQueryJson e parametro `where` dell’API', () => {
  it('JSON → query; JSON non valido o troppo lungo → errore', () => {
    expect(smartQueryJson.safeParse(JSON.stringify(valid)).success).toBe(true);
    expect(smartQueryJson.safeParse('{non json').success).toBe(false);
    expect(smartQueryJson.safeParse('x'.repeat(SMART_QUERY_MAX_JSON + 1)).success).toBe(false);
  });

  const base = { sort: 'updatedAt', page: '1', pageSize: '25' };
  it('`where` è facoltativo e convive con i parametri storici', () => {
    expect(opportunitiesQuery.safeParse(base).success).toBe(true);
    const parsed = opportunitiesQuery.safeParse({
      ...base,
      priority: 'high',
      where: JSON.stringify(valid),
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.where?.v).toBe(2);
  });

  it('un `where` non valido è un errore sul parametro `where`', () => {
    const parsed = opportunitiesQuery.safeParse({
      ...base,
      where: JSON.stringify({ v: 2, where: { field: 'password', op: 'in', value: ['x'] } }),
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]!.path[0]).toBe('where');
    expect(opportunitiesQuery.safeParse({ ...base, where: 'non json' }).success).toBe(false);
  });
});
