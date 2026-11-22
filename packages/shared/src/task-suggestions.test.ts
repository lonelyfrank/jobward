import { describe, expect, it } from 'vitest';
import { suggestTasks, type SuggestionContext, type SuggestionInterview } from './task-suggestions';

const T0 = Date.parse('2026-11-07T10:00:00Z');
const DAY = 86_400_000;
const base: SuggestionContext = {
  status: 'applied',
  appliedOn: '2026-11-01',
  company: 'ACME',
  tasks: [],
  interviews: [],
  today: '2026-11-07',
  timeZone: 'Europe/Rome',
};
const iv = (over: Partial<SuggestionInterview>): SuggestionInterview => ({
  id: 'iv-1',
  sequence: 1,
  status: 'scheduled',
  scheduledAt: T0 + 2 * DAY,
  completedAt: null,
  createdAt: T0 - 10 * DAY,
  ...over,
});

describe('suggestTasks', () => {
  it('S1: follow-up dopo l’invio, scadenza = max(invio + 7, oggi)', () => {
    const [s] = suggestTasks(base);
    expect(s).toMatchObject({
      rule: 'S1',
      kind: 'follow_up',
      key: 'S1:2026-11-01',
      dueOn: '2026-11-08',
    });
    expect(s?.title).toBe('Follow-up: ACME');
    expect(suggestTasks({ ...base, appliedOn: '2026-10-01' })[0]?.dueOn).toBe('2026-11-07');
    expect(suggestTasks({ ...base, appliedOn: null })[0]).toMatchObject({
      key: 'S1:none',
      dueOn: '2026-11-14',
    });
  });
  it('S1: non si ripropone se esiste una follow-up in QUALUNQUE stato (anche annullata)', () => {
    for (const status of ['open', 'done', 'cancelled'] as const)
      expect(
        suggestTasks({ ...base, tasks: [{ kind: 'follow_up', status, createdAt: 1 }] }),
      ).toEqual([]);
    // una task di altro tipo non la copre
    expect(
      suggestTasks({ ...base, tasks: [{ kind: 'general', status: 'open', createdAt: 1 }] }),
    ).toHaveLength(1);
  });
  it('S1 vale solo per Inviata e Screening', () => {
    expect(suggestTasks({ ...base, status: 'screening' })).toHaveLength(1);
    for (const status of ['saved', 'interviewing', 'offer'] as const)
      expect(suggestTasks({ ...base, status }), status).toEqual([]);
  });
  it('mai per candidature archiviate o chiuse', () => {
    for (const status of ['archived', 'rejected', 'withdrawn', 'no_response', 'hired'] as const)
      expect(suggestTasks({ ...base, status, interviews: [iv({})] }), status).toEqual([]);
  });
  it('S2: colloquio programmato entro 7 giorni, preparazione il giorno prima (o oggi)', () => {
    const ctx = { ...base, status: 'interviewing' as const, interviews: [iv({})] };
    expect(suggestTasks(ctx)[0]).toMatchObject({
      rule: 'S2',
      kind: 'preparation',
      key: 'S2:iv-1',
      dueOn: '2026-11-08',
      interviewId: 'iv-1',
    });
    // colloquio domani → la preparazione sarebbe oggi
    expect(suggestTasks({ ...ctx, interviews: [iv({ scheduledAt: T0 + DAY })] })[0]?.dueOn).toBe(
      '2026-11-07',
    );
    // oltre la finestra, passato o annullato: nessuna proposta
    expect(suggestTasks({ ...ctx, interviews: [iv({ scheduledAt: T0 + 9 * DAY })] })).toEqual([]);
    expect(suggestTasks({ ...ctx, interviews: [iv({ scheduledAt: T0 - 2 * DAY })] })).toEqual([]);
    expect(suggestTasks({ ...ctx, interviews: [iv({ status: 'cancelled' })] })).toEqual([]);
  });
  it('S2: coperta solo da una preparazione creata DOPO il colloquio (anche completata)', () => {
    const ctx = { ...base, status: 'interviewing' as const, interviews: [iv({})] };
    expect(
      suggestTasks({ ...ctx, tasks: [{ kind: 'preparation', status: 'done', createdAt: T0 }] }),
    ).toEqual([]);
    expect(
      suggestTasks({
        ...ctx,
        tasks: [{ kind: 'preparation', status: 'open', createdAt: T0 - 20 * DAY }],
      }),
    ).toHaveLength(1);
  });
  it('S3: follow-up dopo un colloquio completato negli ultimi 7 giorni; priorità S3 > S2 > S1', () => {
    const done = iv({
      id: 'iv-0',
      sequence: 1,
      status: 'completed',
      scheduledAt: T0 - 3 * DAY,
      completedAt: T0 - 2 * DAY,
    });
    const next = iv({ id: 'iv-1', sequence: 2 });
    const ctx = { ...base, status: 'interviewing' as const, interviews: [done, next] };
    expect(suggestTasks(ctx)).toHaveLength(1);
    expect(suggestTasks(ctx)[0]).toMatchObject({ rule: 'S3', key: 'S3:iv-0', dueOn: '2026-11-09' });
    // coperta da una follow-up creata dopo il completamento
    const covered = {
      ...ctx,
      tasks: [{ kind: 'follow_up' as const, status: 'open' as const, createdAt: T0 - DAY }],
    };
    expect(suggestTasks(covered)[0]?.rule).toBe('S2');
    // colloquio completato da troppo tempo
    expect(suggestTasks({ ...ctx, interviews: [{ ...done, completedAt: T0 - 9 * DAY }] })).toEqual(
      [],
    );
  });
  it('«Non ora»: la chiave ignorata scompare e subentra la successiva', () => {
    const done = iv({ id: 'iv-0', status: 'completed', completedAt: T0 - DAY });
    const ctx = {
      ...base,
      status: 'interviewing' as const,
      interviews: [done, iv({ id: 'iv-1', sequence: 2 })],
    };
    expect(suggestTasks({ ...ctx, dismissed: new Set(['S3:iv-0']) })[0]?.rule).toBe('S2');
    expect(suggestTasks({ ...ctx, dismissed: new Set(['S3:iv-0', 'S2:iv-1']) })).toEqual([]);
  });
  it('è deterministica: stesso input, stesso output', () => {
    const ctx = { ...base, interviews: [iv({})] };
    expect(suggestTasks(ctx)).toEqual(suggestTasks(JSON.parse(JSON.stringify(ctx)) as typeof ctx));
  });
});
