import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { newId, schema } from '@jobward/database';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, seedBoardWithColumn, seedCard, seedWorkspace } from './helpers';

/**
 * Regressione della migrazione 0001: il DATABASE (non il service layer) deve impedire
 * che una riga colleghi risorse di workspace diversi, anche se gli ID esistono.
 * Ogni test negativo ha un controllo positivo: l'operazione legittima deve riuscire.
 */

const now = () => Date.now();

async function world(email: string) {
  const w = await seedWorkspace(email);
  const b = await seedBoardWithColumn(w.workspaceId);
  const cardId = await seedCard(w.workspaceId, b.boardId, b.columnId);
  return { ...w, ...b, cardId };
}

const field = async (workspaceId: string, boardId: string) => {
  const id = newId();
  await db().insert(schema.customFieldDefinitions).values({
    id,
    workspaceId,
    boardId,
    name: 'F',
    type: 'text',
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
};
const label = async (workspaceId: string, name = `L${newId()}`) => {
  const id = newId();
  await db().insert(schema.labels).values({ id, workspaceId, name, createdAt: now() });
  return id;
};
const rejects = (p: PromiseLike<unknown>) => expect(Promise.resolve(p)).rejects.toThrow();

describe('schede, colonne e bacheche', () => {
  it('accetta una scheda coerente (controllo positivo)', async () => {
    const a = await world('ti-card-ok@example.com');
    expect(a.cardId).toBeTruthy();
  });

  it('rifiuta una scheda che punta a bacheca o colonna di un altro workspace', async () => {
    const a = await world('ti-card-a@example.com');
    const b = await world('ti-card-b@example.com');
    const base = { id: newId(), title: 't', position: 0, createdAt: now(), updatedAt: now() };
    // workspace A, bacheca B
    await rejects(
      db()
        .insert(schema.cards)
        .values({ ...base, workspaceId: a.workspaceId, boardId: b.boardId, columnId: b.columnId }),
    );
    // workspace B, bacheca A
    await rejects(
      db()
        .insert(schema.cards)
        .values({
          ...base,
          id: newId(),
          workspaceId: b.workspaceId,
          boardId: a.boardId,
          columnId: a.columnId,
        }),
    );
    // bacheca e workspace di A ma colonna di B
    await rejects(
      db()
        .insert(schema.cards)
        .values({
          ...base,
          id: newId(),
          workspaceId: a.workspaceId,
          boardId: a.boardId,
          columnId: b.columnId,
        }),
    );
  });

  it('rifiuta una colonna che non appartiene alla bacheca della scheda, anche nello stesso workspace', async () => {
    const a = await world('ti-col-board@example.com');
    const board2 = await seedBoardWithColumn(a.workspaceId);
    await rejects(
      db().insert(schema.cards).values({
        id: newId(),
        workspaceId: a.workspaceId,
        boardId: a.boardId,
        columnId: board2.columnId,
        title: 't',
        position: 0,
        createdAt: now(),
        updatedAt: now(),
      }),
    );
  });

  it('rifiuta una colonna che punta a una bacheca di un altro workspace', async () => {
    const a = await seedWorkspace('ti-colws-a@example.com');
    const b = await world('ti-colws-b@example.com');
    await rejects(
      db().insert(schema.boardColumns).values({
        id: newId(),
        workspaceId: a.workspaceId,
        boardId: b.boardId,
        name: 'x',
        position: 0,
        createdAt: now(),
        updatedAt: now(),
      }),
    );
  });

  it('impedisce di spostare una scheda in una colonna di un’altra bacheca (UPDATE)', async () => {
    const a = await world('ti-move@example.com');
    const board2 = await seedBoardWithColumn(a.workspaceId);
    await rejects(
      db()
        .update(schema.cards)
        .set({ columnId: board2.columnId })
        .where(eq(schema.cards.id, a.cardId)),
    );
    // Controllo positivo: una seconda colonna della stessa bacheca va bene.
    const col2 = newId();
    await db().insert(schema.boardColumns).values({
      id: col2,
      workspaceId: a.workspaceId,
      boardId: a.boardId,
      name: 'c2',
      position: 1,
      createdAt: now(),
      updatedAt: now(),
    });
    await db().update(schema.cards).set({ columnId: col2 }).where(eq(schema.cards.id, a.cardId));
  });
});

describe('dettagli, attività, etichette e campi', () => {
  it('application_details: solo con il workspace della scheda', async () => {
    const a = await world('ti-det-a@example.com');
    const b = await seedWorkspace('ti-det-b@example.com');
    await rejects(
      db().insert(schema.applicationDetails).values({
        cardId: a.cardId,
        workspaceId: b.workspaceId,
        createdAt: now(),
        updatedAt: now(),
      }),
    );
    await db()
      .insert(schema.applicationDetails)
      .values({ cardId: a.cardId, workspaceId: a.workspaceId, createdAt: now(), updatedAt: now() });
  });

  it('tasks: la scheda deve essere del workspace; senza scheda è consentito', async () => {
    const a = await world('ti-task-a@example.com');
    const b = await seedWorkspace('ti-task-b@example.com');
    const t = (workspaceId: string, cardId: string | null) =>
      db().insert(schema.tasks).values({
        id: newId(),
        workspaceId,
        cardId,
        title: 't',
        createdAt: now(),
        updatedAt: now(),
      });
    await rejects(t(b.workspaceId, a.cardId));
    await t(a.workspaceId, a.cardId);
    await t(b.workspaceId, null); // attività del workspace
  });

  it('card_labels: scheda ed etichetta devono essere dello stesso workspace', async () => {
    const a = await world('ti-lab-a@example.com');
    const b = await seedWorkspace('ti-lab-b@example.com');
    const labelA = await label(a.workspaceId);
    const labelB = await label(b.workspaceId);
    await rejects(
      db()
        .insert(schema.cardLabels)
        .values({ cardId: a.cardId, labelId: labelB, workspaceId: a.workspaceId }),
    );
    await rejects(
      db()
        .insert(schema.cardLabels)
        .values({ cardId: a.cardId, labelId: labelA, workspaceId: b.workspaceId }),
    );
    await db()
      .insert(schema.cardLabels)
      .values({ cardId: a.cardId, labelId: labelA, workspaceId: a.workspaceId });
  });

  it('campi personalizzati: definizione nella bacheca del proprio workspace', async () => {
    const a = await world('ti-cfd-a@example.com');
    const b = await world('ti-cfd-b@example.com');
    await rejects(
      db().insert(schema.customFieldDefinitions).values({
        id: newId(),
        workspaceId: a.workspaceId,
        boardId: b.boardId,
        name: 'x',
        type: 'text',
        createdAt: now(),
        updatedAt: now(),
      }),
    );
    expect(await field(a.workspaceId, a.boardId)).toBeTruthy();
  });

  it('valori dei campi: stesso workspace E stessa bacheca (trigger)', async () => {
    const a = await world('ti-cfv-a@example.com');
    const b = await world('ti-cfv-b@example.com');
    const board2 = await seedBoardWithColumn(a.workspaceId);
    const fieldA = await field(a.workspaceId, a.boardId);
    const fieldB = await field(b.workspaceId, b.boardId);
    const fieldOtherBoard = await field(a.workspaceId, board2.boardId);
    const value = (cardId: string, fieldId: string, workspaceId: string) =>
      db()
        .insert(schema.customFieldValues)
        .values({ cardId, fieldId, workspaceId, value: '"x"', updatedAt: now() });

    await rejects(value(a.cardId, fieldB, a.workspaceId)); // campo di un altro workspace
    await rejects(value(a.cardId, fieldA, b.workspaceId)); // workspace dichiarato sbagliato
    await rejects(value(a.cardId, fieldOtherBoard, a.workspaceId)); // stesso workspace, altra bacheca
    await value(a.cardId, fieldA, a.workspaceId); // legittimo
  });

  it('una scheda con valori di campi non può cambiare bacheca (trigger)', async () => {
    const a = await world('ti-cardboard@example.com');
    const board2 = await seedBoardWithColumn(a.workspaceId);
    const fieldA = await field(a.workspaceId, a.boardId);
    await db().insert(schema.customFieldValues).values({
      cardId: a.cardId,
      fieldId: fieldA,
      workspaceId: a.workspaceId,
      value: '1',
      updatedAt: now(),
    });
    await rejects(
      db()
        .update(schema.cards)
        .set({ boardId: board2.boardId, columnId: board2.columnId })
        .where(eq(schema.cards.id, a.cardId)),
    );
  });

  it('activity_events: scheda, bacheca e autore devono appartenere al workspace (trigger)', async () => {
    const a = await world('ti-act-a@example.com');
    const b = await world('ti-act-b@example.com');
    const ev = (o: Partial<typeof schema.activityEvents.$inferInsert>) =>
      db()
        .insert(schema.activityEvents)
        .values({
          id: newId(),
          workspaceId: a.workspaceId,
          type: 'card_created',
          occurredAt: now(),
          ...o,
        });
    await rejects(ev({ cardId: b.cardId }));
    await rejects(ev({ boardId: b.boardId }));
    await rejects(ev({ actorUserId: b.userId })); // utente non membro di A
    await ev({ cardId: a.cardId, boardId: a.boardId, actorUserId: a.userId });
    await ev({}); // evento di workspace senza riferimenti
  });

  it('activity_events: la cronologia sopravvive all’eliminazione della scheda (SET NULL)', async () => {
    const a = await world('ti-act-setnull@example.com');
    const id = newId();
    await db().insert(schema.activityEvents).values({
      id,
      workspaceId: a.workspaceId,
      cardId: a.cardId,
      type: 'card_created',
      occurredAt: now(),
    });
    await db().delete(schema.cards).where(eq(schema.cards.id, a.cardId));
    const [row] = await db()
      .select()
      .from(schema.activityEvents)
      .where(eq(schema.activityEvents.id, id));
    expect(row?.cardId).toBeNull();
    expect(row?.workspaceId).toBe(a.workspaceId);
  });
});

describe('eliminazioni', () => {
  it('una colonna con schede NON si elimina da sola', async () => {
    const a = await world('ti-del-col@example.com');
    await rejects(db().delete(schema.boardColumns).where(eq(schema.boardColumns.id, a.columnId)));
  });

  it('una colonna vuota si elimina', async () => {
    const a = await world('ti-del-empty@example.com');
    const empty = newId();
    await db().insert(schema.boardColumns).values({
      id: empty,
      workspaceId: a.workspaceId,
      boardId: a.boardId,
      name: 'v',
      position: 9,
      createdAt: now(),
      updatedAt: now(),
    });
    await db().delete(schema.boardColumns).where(eq(schema.boardColumns.id, empty));
  });

  it('eliminare una bacheca rimuove colonne, schede, dettagli, attività e valori in cascata', async () => {
    const a = await world('ti-del-board@example.com');
    await db()
      .insert(schema.applicationDetails)
      .values({ cardId: a.cardId, workspaceId: a.workspaceId, createdAt: now(), updatedAt: now() });
    const f = await field(a.workspaceId, a.boardId);
    await db().insert(schema.customFieldValues).values({
      cardId: a.cardId,
      fieldId: f,
      workspaceId: a.workspaceId,
      value: '1',
      updatedAt: now(),
    });
    const l = await label(a.workspaceId);
    await db()
      .insert(schema.cardLabels)
      .values({ cardId: a.cardId, labelId: l, workspaceId: a.workspaceId });
    await db().delete(schema.boards).where(eq(schema.boards.id, a.boardId));
    for (const table of [
      schema.cards,
      schema.boardColumns,
      schema.applicationDetails,
      schema.customFieldValues,
      schema.customFieldDefinitions,
      schema.cardLabels,
    ]) {
      expect(
        await db().select().from(table).where(eq(table.workspaceId, a.workspaceId)),
        'tabella non svuotata',
      ).toHaveLength(0);
    }
    expect(await db().select().from(schema.labels).where(eq(schema.labels.id, l))).toHaveLength(1); // le etichette sono del workspace
  });

  it('eliminare un workspace rimuove tutto il suo contenuto e nient’altro', async () => {
    const a = await world('ti-del-ws-a@example.com');
    const b = await world('ti-del-ws-b@example.com');
    await db().delete(schema.workspaces).where(eq(schema.workspaces.id, a.workspaceId));
    expect(
      await db().select().from(schema.cards).where(eq(schema.cards.workspaceId, a.workspaceId)),
    ).toHaveLength(0);
    expect(
      await db().select().from(schema.cards).where(eq(schema.cards.workspaceId, b.workspaceId)),
    ).toHaveLength(1);
  });
});

describe('migrazione 0001 su un database con dati', () => {
  it('la guardia interrompe la migrazione, senza perdere dati, se le tabelle da ricreare non sono vuote', async () => {
    const [m0, m1] = env.TEST_MIGRATIONS;
    expect(m0?.name).toMatch(/^0000_/);
    expect(m1?.name).toMatch(/^0001_/);
    const d1 = env.MIGRATION_DB;

    await applyD1Migrations(d1, [m0!]); // stato "M0 originale"
    const t = now();
    await d1.batch([
      d1
        .prepare(
          'INSERT INTO workspaces (id,name,timezone,created_at,updated_at) VALUES (?1,?2,?3,?4,?4)',
        )
        .bind('w', 'W', 'UTC', t),
      d1
        .prepare(
          'INSERT INTO boards (id,workspace_id,name,position,created_at,updated_at) VALUES (?1,?2,?3,0,?4,?4)',
        )
        .bind('b', 'w', 'B', t),
      d1
        .prepare(
          'INSERT INTO board_columns (id,workspace_id,board_id,name,position,created_at,updated_at) VALUES (?1,?2,?3,?4,0,?5,?5)',
        )
        .bind('c', 'w', 'b', 'C', t),
    ]);

    await expect(applyD1Migrations(d1, [m0!, m1!])).rejects.toThrow();

    // Nessuna perdita: la riga c'è ancora e lo schema è ancora quello di 0000 (nessun trigger creato).
    const col = await d1.prepare('SELECT id FROM board_columns WHERE id = ?').bind('c').first();
    expect(col).not.toBeNull();
    const triggers = await d1
      .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='trigger'")
      .first<{ n: number }>();
    expect(triggers?.n).toBe(0);
    const guard = await d1
      .prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='_m0h_guard'")
      .first<{ n: number }>();
    expect(guard?.n).toBe(0);

    // Svuotate le tabelle, la migrazione si applica.
    await d1.prepare('DELETE FROM board_columns').run();
    await applyD1Migrations(d1, [m0!, m1!]);
    const after = await d1
      .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='trigger'")
      .first<{ n: number }>();
    expect(after?.n).toBe(5);
  });

  it('i trigger e gli indici attesi esistono nello schema migrato', async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type IN ('trigger','index') AND (name LIKE '%tenant%' OR name LIKE '%board_match%' OR name LIKE '%_unique' OR name LIKE 'cards_board_change%')",
    ).all<{ name: string }>();
    const names = results.map((r) => r.name);
    for (const expected of [
      'activity_events_tenant_insert',
      'activity_events_tenant_update',
      'custom_field_values_board_match_insert',
      'custom_field_values_board_match_update',
      'cards_board_change_custom_values',
      'boards_id_workspace_unique',
      'cards_id_workspace_unique',
      'board_columns_id_board_workspace_unique',
      'labels_id_workspace_unique',
      'custom_field_definitions_id_workspace_unique',
    ])
      expect(names).toContain(expected);
  });
});
