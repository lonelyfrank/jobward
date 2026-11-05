import { describe, expect, it } from 'vitest';
import {
  cardCustomFieldsResponse,
  customFieldResponse,
  customFieldsResponse,
  deletedResponse,
} from '@jobward/schemas';
import { LIMITS } from '@jobward/shared';
import { newId, schema } from '@jobward/database';
import { db } from './helpers';
import { addCard, createMinimalBoard, newUser, type Api } from './kanban-helpers';

async function setup(email: string) {
  const user = await newUser(email);
  const board = await createMinimalBoard(user.api);
  const card = await addCard(user.api, board.columnIds[0]!, 'Scheda');
  return { ...user, ...board, card };
}
type Ctx = Awaited<ReturnType<typeof setup>>;

const createField = (c: Ctx, body: object) =>
  c.api.post(`/boards/${c.boardId}/custom-fields`, body);
const put = (api: Api, cardId: string, fieldId: string, value: unknown) =>
  api.put(`/cards/${cardId}/custom-fields/${fieldId}`, { value });
const cardFields = async (c: Ctx, cardId = c.card.id) =>
  cardCustomFieldsResponse.parse((await c.api.get(`/cards/${cardId}/custom-fields`)).body).fields;

const OPTIONS = [{ label: 'Giorno' }, { label: 'Notte' }, { label: 'Festivi' }];

describe('definizioni: creazione e validazione', () => {
  it('crea ogni tipo con la sua configurazione e restituisce una risposta validata', async () => {
    const c = await setup('cf-types@example.com');
    const bodies = [
      { name: 'Reparto', type: 'text' },
      { name: 'Note sul turno', type: 'long_text', config: { maxLength: 300 } },
      {
        name: 'Anni di esperienza',
        type: 'number',
        config: { min: 0, max: 50, integerOnly: true },
      },
      { name: 'Data colloquio', type: 'date' },
      { name: 'Patentino', type: 'boolean' },
      { name: 'Turni', type: 'single_select', config: { options: OPTIONS } },
      { name: 'Disponibilità', type: 'multi_select', config: { options: OPTIONS } },
      { name: 'Sito della struttura', type: 'url' },
    ];
    for (const body of bodies) {
      const res = await createField(c, body);
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(customFieldResponse.parse(res.body).field).toMatchObject({
        name: body.name,
        type: body.type,
        boardId: c.boardId,
        isActive: true,
        valueCount: 0,
      });
    }
    const list = customFieldsResponse.parse(
      (await c.api.get(`/boards/${c.boardId}/custom-fields`)).body,
    );
    expect(list.fields.map((f) => f.name)).toEqual(bodies.map((b) => b.name)); // ordine di creazione
  });

  it('il server assegna ID stabili e distinti alle opzioni', async () => {
    const c = await setup('cf-optids@example.com');
    const res = await createField(c, {
      name: 'Turni',
      type: 'single_select',
      config: { options: OPTIONS },
    });
    const options = res.body.field.config.options as { id: string; label: string }[];
    expect(options.map((o) => o.label)).toEqual(['Giorno', 'Notte', 'Festivi']);
    expect(new Set(options.map((o) => o.id)).size).toBe(3);
    expect(options.every((o) => o.id.length > 8)).toBe(true);
  });

  it('rifiuta configurazioni non valide', async () => {
    const c = await setup('cf-badconfig@example.com');
    const bad: object[] = [
      { name: '', type: 'text' },
      { name: 'x', type: 'colore' },
      { name: 'x' },
      { name: 'Senza opzioni', type: 'single_select', config: { options: [] } },
      { name: 'Senza config', type: 'multi_select' },
      {
        name: 'Opzioni doppie',
        type: 'single_select',
        config: { options: [{ label: 'A' }, { label: ' a ' }] },
      },
      { name: 'Opzione vuota', type: 'single_select', config: { options: [{ label: '  ' }] } },
      {
        name: 'Troppe',
        type: 'single_select',
        config: { options: Array.from({ length: 101 }, (_, i) => ({ label: `o${i}` })) },
      },
      { name: 'Min>Max', type: 'number', config: { min: 10, max: 1 } },
      { name: 'Config su date', type: 'date', config: { options: [] } },
      { name: 'Lunghezza', type: 'text', config: { maxLength: 100000 } },
      { name: 'Altro', type: 'text', workspaceId: 'altro' },
      { name: 'x', type: 'text', id: 'forzato' },
    ];
    for (const body of bad) {
      expect((await createField(c, body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('il nome è univoco nella bacheca (senza distinzione di maiuscole) ma non tra bacheche', async () => {
    const c = await setup('cf-unique@example.com');
    expect((await createField(c, { name: 'Reparto', type: 'text' })).status).toBe(201);
    const dup = await createField(c, { name: 'REPARTO', type: 'boolean' });
    expect(dup.status).toBe(409);
    const other = await createMinimalBoard(c.api, 'Seconda');
    const res = await c.api.post(`/boards/${other.boardId}/custom-fields`, {
      name: 'Reparto',
      type: 'text',
    });
    expect(res.status).toBe(201);
  });

  it('tetto di campi per bacheca (409)', async () => {
    const c = await setup('cf-cap@example.com');
    const now = Date.now();
    const rows = Array.from({ length: LIMITS.customFieldsPerBoardMax }, (_, i) => ({
      id: newId(),
      workspaceId: c.workspaceId,
      boardId: c.boardId,
      name: `C${i}`,
      type: 'text' as const,
      config: '{}',
      position: i + 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }));
    for (let i = 0; i < rows.length; i += 8) {
      await db()
        .insert(schema.customFieldDefinitions)
        .values(rows.slice(i, i + 8));
    }
    const res = await createField(c, { name: 'Di troppo', type: 'text' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/al massimo/);
  });
});

describe('valori: tipi, integrità e persistenza', () => {
  async function allTypes(c: Ctx) {
    const make = async (body: object) => (await createField(c, body)).body.field;
    return {
      text: await make({ name: 'Testo', type: 'text', config: { maxLength: 12 } }),
      long: await make({ name: 'Lungo', type: 'long_text' }),
      number: await make({
        name: 'Numero',
        type: 'number',
        config: { min: 0, max: 100, integerOnly: true },
      }),
      date: await make({ name: 'Data', type: 'date' }),
      bool: await make({ name: 'Booleano', type: 'boolean' }),
      single: await make({ name: 'Singola', type: 'single_select', config: { options: OPTIONS } }),
      multi: await make({ name: 'Multipla', type: 'multi_select', config: { options: OPTIONS } }),
      url: await make({ name: 'Indirizzo', type: 'url' }),
    };
  }

  it('numeri restano numeri, booleani booleani, array array: round-trip senza coercizioni', async () => {
    const c = await setup('cf-roundtrip@example.com');
    const f = await allTypes(c);
    const single = f.single.config.options[1].id;
    const multi = [f.multi.config.options[0].id, f.multi.config.options[2].id];
    const values: [{ id: string }, unknown][] = [
      [f.text, 'Cardiologia'],
      [f.long, 'Riga 1\nRiga 2'],
      [f.number, 42],
      [f.date, '2026-12-01'],
      [f.bool, false],
      [f.single, single],
      [f.multi, multi],
      [f.url, 'https://example.com/struttura'],
    ];
    for (const [field, value] of values) {
      const res = await put(c.api, c.card.id, field.id, value);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.field.value).toEqual(value);
      expect(res.body.field.hasValue).toBe(true);
    }
    const read = await cardFields(c);
    expect(read).toHaveLength(8);
    const by = Object.fromEntries(read.map((e) => [e.field.name, e.value]));
    expect(by['Numero']).toBe(42);
    expect(typeof by['Numero']).toBe('number');
    expect(by['Booleano']).toBe(false); // false ≠ assente
    expect(by['Multipla']).toEqual(multi);
    expect(by['Data']).toBe('2026-12-01');
  });

  it('valori non conformi sono rifiutati (400) e non cambiano nulla', async () => {
    const c = await setup('cf-invalid@example.com');
    const f = await allTypes(c);
    const cases: [{ id: string }, unknown][] = [
      [f.text, 'x'.repeat(13)],
      [f.text, 5],
      [f.number, '42'],
      [f.number, 101],
      [f.number, -1],
      [f.number, 4.5],
      [f.date, '2026-02-30'],
      [f.date, '01/12/2026'],
      [f.bool, 'true'],
      [f.bool, 1],
      [f.single, 'non-esiste'],
      [f.single, ['a']],
      [f.multi, 'singolo'],
      [f.multi, ['non-esiste']],
      [f.multi, [f.multi.config.options[0].id, f.multi.config.options[0].id]],
      [f.url, 'javascript:alert(1)'],
      [f.url, 'ftp://example.com'],
    ];
    for (const [field, value] of cases) {
      const res = await put(c.api, c.card.id, field.id, value);
      expect(res.status, `${field.id} ← ${JSON.stringify(value)}`).toBe(400);
    }
    const stored = (await cardFields(c)).filter((e) => e.hasValue);
    expect(stored).toEqual([]);
  });

  it('null (svuotato) è persistito ed è distinto da "mai compilato"', async () => {
    const c = await setup('cf-null@example.com');
    const field = (await createField(c, { name: 'Reparto', type: 'text' })).body.field;
    expect((await cardFields(c))[0]).toMatchObject({ value: null, hasValue: false });
    await put(c.api, c.card.id, field.id, 'Cardiologia');
    await put(c.api, c.card.id, field.id, null);
    expect((await cardFields(c))[0]).toMatchObject({ value: null, hasValue: true });
    const row = await c.api.get(`/boards/${c.boardId}/custom-fields`);
    expect(row.body.fields[0].valueCount).toBe(1);
  });

  it('i valori persistono e sono per scheda', async () => {
    const c = await setup('cf-persist@example.com');
    const second = await addCard(c.api, c.columnIds[0]!, 'Seconda');
    const field = (await createField(c, { name: 'Reparto', type: 'text' })).body.field;
    await put(c.api, c.card.id, field.id, 'A');
    await put(c.api, second.id, field.id, 'B');
    expect((await cardFields(c))[0]!.value).toBe('A');
    expect((await cardFields(c, second.id))[0]!.value).toBe('B');
  });

  it('un valore salvato corrotto direttamente nel database non viene mostrato come valido', async () => {
    const c = await setup('cf-corrupt@example.com');
    const field = (await createField(c, { name: 'Numero', type: 'number' })).body.field;
    await db().insert(schema.customFieldValues).values({
      cardId: c.card.id,
      fieldId: field.id,
      workspaceId: c.workspaceId,
      value: '"non un numero"',
      updatedAt: Date.now(),
    });
    expect((await cardFields(c))[0]).toMatchObject({ value: null, hasValue: false });
  });

  it('scheda archiviata: 409; chiavi extra nel corpo: 400', async () => {
    const c = await setup('cf-archived@example.com');
    const field = (await createField(c, { name: 'Reparto', type: 'text' })).body.field;
    expect(
      (await c.api.put(`/cards/${c.card.id}/custom-fields/${field.id}`, { value: 'x', extra: 1 }))
        .status,
    ).toBe(400);
    await c.api.post(`/cards/${c.card.id}/archive`);
    expect((await put(c.api, c.card.id, field.id, 'x')).status).toBe(409);
  });
});

describe('modifica delle definizioni', () => {
  it('il tipo non si può cambiare (nessuna conversione silenziosa)', async () => {
    const c = await setup('cf-type@example.com');
    const field = (await createField(c, { name: 'Anni', type: 'text' })).body.field;
    const res = await c.api.patch(`/custom-fields/${field.id}`, { type: 'number' });
    expect(res.status).toBe(400);
    expect((await c.api.get(`/boards/${c.boardId}/custom-fields`)).body.fields[0].type).toBe(
      'text',
    );
  });

  it('rinominare un’opzione ne conserva l’ID: i valori salvati restano validi e mostrano il nuovo nome', async () => {
    const c = await setup('cf-rename@example.com');
    const field = (
      await createField(c, { name: 'Turni', type: 'single_select', config: { options: OPTIONS } })
    ).body.field;
    const night = field.config.options[1];
    await put(c.api, c.card.id, field.id, night.id);

    const renamed = field.config.options.map((o: { id: string; label: string }) =>
      o.id === night.id ? { ...o, label: 'Notturno' } : o,
    );
    const res = await c.api.patch(`/custom-fields/${field.id}`, { config: { options: renamed } });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const after = (await cardFields(c))[0]!;
    expect(after.value).toBe(night.id);
    expect(
      after.field.type === 'single_select' &&
        after.field.config.options.find((o) => o.id === night.id)?.label,
    ).toBe('Notturno');
  });

  it('aggiungere un’opzione senza id: ne riceve uno; le esistenti restano', async () => {
    const c = await setup('cf-addopt@example.com');
    const field = (
      await createField(c, { name: 'Turni', type: 'multi_select', config: { options: OPTIONS } })
    ).body.field;
    const res = await c.api.patch(`/custom-fields/${field.id}`, {
      config: { options: [...field.config.options, { label: 'Reperibilità' }] },
    });
    const options = res.body.field.config.options as { id: string; label: string }[];
    expect(options).toHaveLength(4);
    expect(options.slice(0, 3).map((o) => o.id)).toEqual(
      field.config.options.map((o: { id: string }) => o.id),
    );
    expect(options[3]!.id).toBeTruthy();
  });

  it('rimuovere un’opzione ancora in uso è rifiutato (409) con il numero di schede; se non è in uso si può', async () => {
    const c = await setup('cf-rmopt@example.com');
    const second = await addCard(c.api, c.columnIds[0]!, 'Seconda');
    const field = (
      await createField(c, { name: 'Turni', type: 'multi_select', config: { options: OPTIONS } })
    ).body.field;
    const [day, night, holidays] = field.config.options;
    await put(c.api, c.card.id, field.id, [day.id, night.id]);
    await put(c.api, second.id, field.id, [night.id]);

    const withoutNight = { options: [day, holidays] };
    const refuse = await c.api.patch(`/custom-fields/${field.id}`, { config: withoutNight });
    expect(refuse.status).toBe(409);
    expect(refuse.body.error.message).toContain('2 schede');
    // La definizione non è cambiata.
    expect(
      (await c.api.get(`/boards/${c.boardId}/custom-fields`)).body.fields[0].config.options,
    ).toHaveLength(3);

    const withoutHolidays = { options: [day, night] };
    expect(
      (await c.api.patch(`/custom-fields/${field.id}`, { config: withoutHolidays })).status,
    ).toBe(200);
  });

  it('restringere i limiti di un numero incompatibili con i valori salvati → 409; compatibili → 200', async () => {
    const c = await setup('cf-numcfg@example.com');
    const field = (await createField(c, { name: 'Anni', type: 'number' })).body.field;
    await put(c.api, c.card.id, field.id, 30);
    expect(
      (await c.api.patch(`/custom-fields/${field.id}`, { config: { max: 20, integerOnly: false } }))
        .status,
    ).toBe(409);
    expect(
      (await c.api.patch(`/custom-fields/${field.id}`, { config: { max: 40, integerOnly: true } }))
        .status,
    ).toBe(200);
    expect(
      (await c.api.patch(`/custom-fields/${field.id}`, { config: { min: 5, max: 1 } })).status,
    ).toBe(400);
  });

  it('config non valida per il tipo del campo → 400; cambio solo del nome non tocca i valori', async () => {
    const c = await setup('cf-cfgtype@example.com');
    const field = (await createField(c, { name: 'Reparto', type: 'text' })).body.field;
    await put(c.api, c.card.id, field.id, 'Cardiologia');
    expect(
      (await c.api.patch(`/custom-fields/${field.id}`, { config: { options: [{ label: 'A' }] } }))
        .status,
    ).toBe(400);
    const renamed = await c.api.patch(`/custom-fields/${field.id}`, { name: 'Unità operativa' });
    expect(renamed.body.field).toMatchObject({ name: 'Unità operativa', valueCount: 1 });
    expect((await cardFields(c))[0]!.value).toBe('Cardiologia');
    expect((await c.api.patch(`/custom-fields/${field.id}`, {})).status).toBe(400);
  });
});

describe('disattivazione, riattivazione, eliminazione', () => {
  it('disattivare nasconde il campo ma CONSERVA i valori; riattivare li riporta', async () => {
    const c = await setup('cf-toggle@example.com');
    const field = (await createField(c, { name: 'Reparto', type: 'text' })).body.field;
    await put(c.api, c.card.id, field.id, 'Cardiologia');

    const off = await c.api.patch(`/custom-fields/${field.id}`, { isActive: false });
    expect(off.body.field).toMatchObject({ isActive: false, valueCount: 1 });
    expect(await cardFields(c)).toEqual([]); // nascosto dalla scheda
    expect((await c.api.get(`/boards/${c.boardId}/custom-fields`)).body.fields).toHaveLength(1); // visibile nel configuratore
    expect((await put(c.api, c.card.id, field.id, 'Altro')).status).toBe(409); // niente nuove scritture

    await c.api.patch(`/custom-fields/${field.id}`, { isActive: true });
    expect((await cardFields(c))[0]).toMatchObject({ value: 'Cardiologia', hasValue: true });
  });

  it('eliminazione: senza valori è diretta; con valori richiede deleteValues e li rimuove', async () => {
    const c = await setup('cf-delete@example.com');
    const empty = (await createField(c, { name: 'Vuoto', type: 'text' })).body.field;
    const removed = await c.api.delete(`/custom-fields/${empty.id}`, {});
    expect(removed.status).toBe(200);
    expect(deletedResponse.parse(removed.body)).toEqual({ id: empty.id });

    const used = (await createField(c, { name: 'Usato', type: 'text' })).body.field;
    await put(c.api, c.card.id, used.id, 'dato');
    const refuse = await c.api.delete(`/custom-fields/${used.id}`, {});
    expect(refuse.status).toBe(409);
    expect(refuse.body.error.message).toContain('1 scheda');
    expect((await c.api.get(`/boards/${c.boardId}/custom-fields`)).body.fields).toHaveLength(1);

    expect((await c.api.delete(`/custom-fields/${used.id}`, { deleteValues: true })).status).toBe(
      200,
    );
    expect((await c.api.get(`/boards/${c.boardId}/custom-fields`)).body.fields).toEqual([]);
    expect(await cardFields(c)).toEqual([]);
    expect((await c.api.get(`/cards/${c.card.id}`)).status).toBe(200); // la scheda è intatta
  });

  it('eliminare la bacheca elimina i suoi campi e valori (cascata), senza residui', async () => {
    const c = await setup('cf-cascade@example.com');
    const field = (await createField(c, { name: 'Reparto', type: 'text' })).body.field;
    await put(c.api, c.card.id, field.id, 'x');
    expect((await c.api.delete(`/boards/${c.boardId}`, {})).status).toBe(200);
    const left = await db().select().from(schema.customFieldValues);
    expect(left.filter((v) => v.fieldId === field.id)).toEqual([]);
  });
});

describe('ordinamento dei campi', () => {
  it('si riordinano con un’ancora; l’ordine persiste e a ogni bacheca il suo', async () => {
    const c = await setup('cf-order@example.com');
    const ids: string[] = [];
    for (const name of ['A', 'B', 'C'])
      ids.push((await createField(c, { name, type: 'text' })).body.field.id);
    const names = async () =>
      (await c.api.get(`/boards/${c.boardId}/custom-fields`)).body.fields.map(
        (f: { name: string }) => f.name,
      );
    await c.api.post(`/custom-fields/${ids[2]}/move`, { afterId: null });
    expect(await names()).toEqual(['C', 'A', 'B']);
    await c.api.post(`/custom-fields/${ids[2]}/move`, { afterId: ids[0] });
    expect(await names()).toEqual(['A', 'C', 'B']);
    expect((await c.api.post(`/custom-fields/${ids[0]}/move`, { afterId: ids[0] })).status).toBe(
      409,
    );
    expect(
      (await c.api.post(`/custom-fields/${ids[0]}/move`, { afterId: 'inesistente' })).status,
    ).toBe(409);
  });
});
