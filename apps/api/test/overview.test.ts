import { describe, expect, it } from 'vitest';
import { overviewResponse } from '@meet-roulette/schemas';
import { createApp } from '../src/app';
import { addCard, createMinimalBoard, newUser } from './kanban-helpers';
import { call, devEnv, seedBoardWithColumn, seedCard, seedTask, seedWorkspace } from './helpers';

const app = createApp();
const HOUR = 3_600_000;

describe('GET /api/v1/overview', () => {
  it('con workspace vuoto restituisce soli zeri e liste vuote (nessun dato dimostrativo)', async () => {
    const { workspaceId } = await seedWorkspace('ov-empty@example.com');
    const res = await call<any>(
      app,
      devEnv('ov-empty@example.com'),
      `/api/v1/overview?workspaceId=${workspaceId}`,
    );
    expect(res.status).toBe(200);
    expect(overviewResponse.parse(res.body)).toEqual({
      workspaceId,
      counts: {
        boards: 0,
        opportunities: 0,
        applicationsSubmitted: 0,
        interviews: 0,
        openTasks: 0,
        overdueTasks: 0,
      },
      upcomingTasks: [],
      recentBoards: [],
      recentCards: [],
    });
  });

  it('calcola i contatori dai dati reali, escludendo schede archiviate e attività completate', async () => {
    const { workspaceId } = await seedWorkspace('ov-data@example.com');
    const { boardId, columnId } = await seedBoardWithColumn(workspaceId);
    await seedCard(workspaceId, boardId, columnId, { title: 'a' });
    await seedCard(workspaceId, boardId, columnId, {
      title: 'b',
      appliedOn: '2026-11-01',
      stage: 'applied',
    });
    await seedCard(workspaceId, boardId, columnId, {
      title: 'c',
      appliedOn: '2026-11-02',
      stage: 'interviewing',
    });
    await seedCard(workspaceId, boardId, columnId, {
      title: 'archiviata',
      appliedOn: '2026-11-02',
      stage: 'interviewing',
      archivedAt: Date.now(),
    });

    const now = Date.now();
    await seedTask(workspaceId, { title: 'scaduta', dueAt: now - HOUR });
    await seedTask(workspaceId, { title: 'tra 2 ore', dueAt: now + 2 * HOUR });
    await seedTask(workspaceId, { title: 'tra 1 ora', dueAt: now + HOUR });
    await seedTask(workspaceId, { title: 'senza scadenza' });
    await seedTask(workspaceId, { title: 'fatta', dueAt: now + HOUR, completedAt: now });

    const res = await call<any>(
      app,
      devEnv('ov-data@example.com'),
      `/api/v1/overview?workspaceId=${workspaceId}`,
    );
    expect(res.body.counts).toEqual({
      boards: 1,
      opportunities: 3,
      applicationsSubmitted: 2,
      interviews: 1,
      openTasks: 4,
      overdueTasks: 1,
    });
    expect(res.body.upcomingTasks.map((t: { title: string }) => t.title)).toEqual([
      'tra 1 ora',
      'tra 2 ore',
    ]);
    expect(res.body.recentBoards).toHaveLength(1);
    expect(res.body.recentCards).toHaveLength(3); // le archiviate non compaiono
  });

  it('opportunità recenti: dati reali creati dall’API, con bacheca e colonna, solo del proprio workspace', async () => {
    const mine = await newUser('ov-recent@example.com');
    const other = await newUser('ov-recent-other@example.com');
    const board = await createMinimalBoard(mine.api, 'Estate');
    const otherBoard = await createMinimalBoard(other.api, 'Altrui');
    await addCard(other.api, otherBoard.columnIds[0]!, 'Non mia');
    const first = await addCard(mine.api, board.columnIds[0]!, 'Prima');
    await new Promise((r) => setTimeout(r, 3));
    await addCard(mine.api, board.columnIds[1]!, 'Seconda');
    await new Promise((r) => setTimeout(r, 3));
    await mine.api.post(`/cards/${first.id}/move`, {
      columnId: board.columnIds[2],
      afterCardId: null,
    });

    const res = await mine.api.get('/overview');
    expect(res.status).toBe(200);
    expect(res.body.counts).toMatchObject({ boards: 1, opportunities: 2 });
    expect(res.body.recentCards.map((c: any) => [c.title, c.boardName, c.columnName])).toEqual([
      ['Prima', 'Estate', 'Completate'], // spostata per ultima ⇒ più recente
      ['Seconda', 'Estate', 'In corso'],
    ]);
    expect(JSON.stringify(res.body)).not.toContain('Non mia');

    await mine.api.post(`/cards/${first.id}/archive`);
    expect((await mine.api.get('/overview')).body.recentCards.map((c: any) => c.title)).toEqual([
      'Seconda',
    ]);
  });

  it('non include dati di altri workspace', async () => {
    const mine = await seedWorkspace('ov-mine@example.com');
    const other = await seedWorkspace('ov-other@example.com');
    const b = await seedBoardWithColumn(other.workspaceId);
    await seedCard(other.workspaceId, b.boardId, b.columnId);
    await seedTask(other.workspaceId, { title: 'altrui', dueAt: Date.now() + HOUR });

    const res = await call<any>(
      app,
      devEnv('ov-mine@example.com'),
      `/api/v1/overview?workspaceId=${mine.workspaceId}`,
    );
    expect(res.body.counts.boards).toBe(0);
    expect(res.body.counts.opportunities).toBe(0);
    expect(res.body.counts.openTasks).toBe(0);
    expect(res.body.upcomingTasks).toEqual([]);
  });
});
