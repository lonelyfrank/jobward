import { describe, expect, it } from 'vitest';
import { ACTIVITY_EVENT_TYPES } from './constants';
import {
  compareTimelineEntries,
  mergeTimeline,
  pipelineEventIntent,
  safeTimelineMetadata,
  timelineDedupeKey,
  type TimelineSystemEvent,
} from './timeline';

const event = (overrides: Partial<TimelineSystemEvent> = {}): TimelineSystemEvent => ({
  id: 'event',
  type: 'interview_created',
  occurredAt: 100,
  cardId: 'card',
  metadata: { interviewId: 'round', sequence: 1, scheduledAt: 200 },
  ...overrides,
});
describe('timeline pura, compatibile con gli eventi M2.5', () => {
  it('deduplica replay identici e rifiuta identità duplicate con dati diversi', () => {
    expect(mergeTimeline([event(), event()], [])).toHaveLength(1);
    expect(() => mergeTimeline([event(), event({ occurredAt: 101 })], [])).toThrow(
      'timeline_identity_conflict',
    );
    expect(
      timelineDedupeKey('interview_created', { type: 'interview', id: 'round' }, 'op'),
    ).not.toBe(timelineDedupeKey('interview_created', { type: 'card', id: 'round' }, 'op'));
  });
  it('supporta collegamenti espliciti a documenti senza copiarne contenuti', () => {
    const linked = event({
      type: 'contact_logged',
      entity: { type: 'document', id: 'document' },
      metadata: { note: 'PRIVATE' },
    });
    expect(mergeTimeline([linked], [])[0]).toMatchObject({
      entity: { type: 'document', id: 'document' },
      data: {},
    });
  });
  it.each(ACTIVITY_EVENT_TYPES)('accetta il tipo persistente %s', (type) => {
    expect(mergeTimeline([event({ type })], [])[0]?.kind).toBe(type);
  });
  it('M3-C2: la riapertura è un tipo persistente (migrazione 0005)', () => {
    expect(ACTIVITY_EVENT_TYPES as readonly string[]).toContain('application_reopened');
  });
  it('whitelist: nessuna nota, feedback, titolo o oggetto annidato nei metadati', () => {
    const input = Object.freeze({
      interviewId: 'round',
      sequence: 2,
      scheduledAt: 200,
      preparationNotes: 'SECRET',
      feedbackNotes: 'SECRET',
      body: 'SECRET',
      title: 'SECRET',
      nested: { body: 'SECRET' },
      result: 'positive',
    });
    expect(safeTimelineMetadata('interview_created', input)).toEqual({
      interviewId: 'round',
      sequence: 2,
      scheduledAt: 200,
      result: 'positive',
    });
    expect(
      safeTimelineMetadata('stage_changed', { from: 'saved', to: 'offer', note: 'SECRET' }),
    ).toEqual({ from: 'saved', to: 'offer' });
    expect(safeTimelineMetadata('stage_changed', { from: 'SECRET', to: 123 })).toEqual({});
  });
  it('ordine totale a parità di istante e ID tra fonti, senza mutazioni', () => {
    const events = Object.freeze([
      Object.freeze(event({ id: 'b' })),
      Object.freeze(event({ id: 'a' })),
    ]);
    const notes = Object.freeze([
      Object.freeze({ id: 'b', cardId: 'card', createdAt: 100, body: 'Nota privata' }),
    ]);
    const first = mergeTimeline(events, notes);
    expect(first.map((e) => [e.id, e.source])).toEqual([
      ['b', 'system'],
      ['b', 'note'],
      ['a', 'system'],
    ]);
    expect(mergeTimeline([...events].reverse(), notes)).toEqual(first);
    expect(first.find((e) => e.source === 'note')?.data).toEqual({ body: 'Nota privata' });
    expect(JSON.stringify(first.filter((e) => e.source === 'system'))).not.toContain(
      'Nota privata',
    );
    expect(events.map((e) => e.id)).toEqual(['b', 'a']);
  });
  it('timestamp prima dell’ID, collegamenti alle entità e riferimenti mancanti', () => {
    const merged = mergeTimeline(
      [
        event({ id: 'z', occurredAt: 1 }),
        event({ id: 'a', occurredAt: 2, type: 'application_reopened', metadata: {} }),
        event({ id: 'deleted', cardId: null, type: 'contact_logged', metadata: {} }),
      ],
      [],
    );
    expect(merged[0]?.id).toBe('deleted');
    expect(merged.find((e) => e.id === 'a')?.entity).toEqual({ type: 'card', id: 'card' });
    expect(merged.find((e) => e.id === 'z')?.entity).toEqual({ type: 'interview', id: 'round' });
    expect(merged.find((e) => e.id === 'deleted')?.entity).toBeNull();
  });
  it('intenti di riapertura/correzione con dedupe stabile e senza collisioni da separatori', () => {
    const base = {
      cardId: 'a:b',
      operationId: 'c',
      kind: 'correction',
      from: 'rejected',
      to: 'offer',
    } as const;
    const first = pipelineEventIntent('application_reopened', base);
    expect(first).toEqual(pipelineEventIntent('application_reopened', base));
    expect(first.metadata).toEqual({
      kind: 'correction',
      fromStatus: 'rejected',
      toStatus: 'offer',
    });
    expect(first.dedupeKey).not.toBe(
      pipelineEventIntent('application_reopened', { ...base, cardId: 'a', operationId: 'b:c' })
        .dedupeKey,
    );
    expect(first.dedupeKey).not.toBe(
      pipelineEventIntent('application_reopened', { ...base, operationId: 'new' }).dedupeKey,
    );
  });
});

describe('Timeline — voci derivate dalle attività (D-06)', () => {
  const task = {
    id: 'task-aaaaaaaaaaaaaaaa',
    cardId: 'card-1',
    kind: 'follow_up' as const,
    createdAt: 100,
    completedAt: 300,
    cancelledAt: null,
  };
  it('deriva creata e completata dai timestamp, senza testo libero', () => {
    const entries = mergeTimeline([], [], [task]);
    expect(entries.map((e) => [e.kind, e.id, e.occurredAt])).toEqual([
      ['task_completed', 'task-aaaaaaaaaaaaaaaa:completed', 300],
      ['task_created', 'task-aaaaaaaaaaaaaaaa:created', 100],
    ]);
    const first = entries[0];
    expect(first?.source).toBe('task');
    expect(first?.data).toEqual({ taskId: task.id, taskKind: 'follow_up' });
    expect(JSON.stringify(entries)).not.toMatch(/title|description/);
  });
  it('riaprire azzera il timestamp: la voce «completata» sparisce (limite dichiarato)', () => {
    const entries = mergeTimeline([], [], [{ ...task, completedAt: null }]);
    expect(entries.map((e) => e.kind)).toEqual(['task_created']);
  });
  it('una task annullata produce la voce «annullata»', () => {
    const entries = mergeTimeline([], [], [{ ...task, completedAt: null, cancelledAt: 400 }]);
    expect(entries.map((e) => e.kind)).toEqual(['task_cancelled', 'task_created']);
  });
  it('ordine totale e stabile con tre fonti, a parità di istante', () => {
    const events = [
      {
        id: 'evt-1',
        type: 'card_created' as const,
        occurredAt: 100,
        cardId: 'card-1',
        metadata: {},
      },
    ];
    const notes = [{ id: 'note-1', cardId: 'card-1', createdAt: 100, body: 'x' }];
    const a = mergeTimeline(events, notes, [task]);
    const b = mergeTimeline([...events].reverse(), [...notes].reverse(), [task]);
    expect(a).toEqual(b);
    expect(new Set(a.map((e) => `${e.source}|${e.id}`)).size).toBe(a.length);
    for (let i = 1; i < a.length; i += 1)
      expect(compareTimelineEntries(a[i - 1]!, a[i]!)).toBeLessThan(0);
  });
  it('senza task il risultato è identico a quello delle due fonti precedenti', () => {
    const notes = [{ id: 'note-1', cardId: 'card-1', createdAt: 5, body: 'x' }];
    expect(mergeTimeline([], notes)).toEqual(mergeTimeline([], notes, []));
  });
});
