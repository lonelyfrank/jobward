import {
  ACTIVITY_EVENT_TYPES,
  OUTCOMES,
  PRIORITIES,
  STAGES,
  INTERVIEW_RESULTS,
  type ActivityEventType,
} from './constants';
import { PIPELINE_STATUSES, type PipelineStatus, type PipelineTransitionKind } from './pipeline';

/** Solo dominio: il CHECK SQL e il vocabolario persistente restano quelli M2.5 fino a C2. */
export type TimelineEventType = ActivityEventType | 'application_reopened';
export type TimelineEntity = {
  readonly type: 'card' | 'interview' | 'note' | 'document';
  readonly id: string;
};
export type SafeTimelineMetadata = Readonly<Record<string, string | number | null>>;
export interface PipelineEventIntent {
  readonly type:
    'stage_changed' | 'application_submitted' | 'application_closed' | 'application_reopened';
  readonly metadata: SafeTimelineMetadata;
  readonly dedupeKey: string;
}

/** L'indice persistente C2 aggiungerà lo scope workspace; qui si produce solo l'intento. */
export function timelineDedupeKey(
  type: TimelineEventType,
  entity: TimelineEntity,
  operationId: string,
): string {
  return JSON.stringify([type, entity.type, entity.id, operationId]);
}
export function pipelineEventIntent(
  type: PipelineEventIntent['type'],
  context: {
    readonly cardId: string;
    readonly operationId: string;
    readonly kind: PipelineTransitionKind;
    readonly from: PipelineStatus;
    readonly to: PipelineStatus;
    readonly metadata?: SafeTimelineMetadata;
  },
): PipelineEventIntent {
  return {
    type,
    dedupeKey: timelineDedupeKey(type, { type: 'card', id: context.cardId }, context.operationId),
    metadata: {
      ...safeTimelineMetadata(type, context.metadata ?? {}),
      kind: context.kind,
      fromStatus: context.from,
      toStatus: context.to,
    },
  };
}

/** Whitelist per tipo, non una copia dei metadati: scarta testi liberi e campi inattesi. */
export function safeTimelineMetadata(
  type: TimelineEventType,
  input: Readonly<Record<string, unknown>>,
): SafeTimelineMetadata {
  const result: Record<string, string | number | null> = {};
  const enumField = (key: string, values: readonly string[]) => {
    const value = input[key];
    if (value === null || (typeof value === 'string' && values.includes(value)))
      result[key] = value;
  };
  const numberField = (key: string) => {
    const value = input[key];
    if (value === null || (typeof value === 'number' && Number.isFinite(value)))
      result[key] = value;
  };
  const idField = (key: string) => {
    const value = input[key];
    if (typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)) result[key] = value;
  };
  enumField('kind', ['advance', 'close', 'reopen', 'correction']);
  enumField('fromOutcome', OUTCOMES);
  enumField('toOutcome', OUTCOMES);
  enumField('fromStatus', PIPELINE_STATUSES);
  enumField('toStatus', PIPELINE_STATUSES);
  if (type === 'stage_changed') {
    enumField('from', STAGES);
    enumField('to', STAGES);
  }
  if (type === 'priority_changed') {
    enumField('from', PRIORITIES);
    enumField('to', PRIORITIES);
  }
  if (type === 'application_closed' || type === 'application_reopened')
    enumField('outcome', OUTCOMES);
  if (type === 'application_submitted') {
    const v = input['appliedOn'];
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) result['appliedOn'] = v;
  }
  if (type.startsWith('interview_')) {
    idField('interviewId');
    numberField('sequence');
    enumField('result', INTERVIEW_RESULTS);
    if (type === 'interview_rescheduled') {
      numberField('from');
      numberField('to');
    }
    if (type === 'interview_created' || type === 'interview_next_round_created')
      numberField('scheduledAt');
  }
  if (['card_created', 'card_moved', 'card_archived', 'card_restored'].includes(type)) {
    for (const key of ['columnId', 'fromColumnId', 'toColumnId']) idField(key);
  }
  if (type === 'task_added' || type === 'task_completed') idField('taskId');
  return result;
}
export interface TimelineSystemEvent {
  readonly id: string;
  readonly type: TimelineEventType;
  readonly occurredAt: number;
  readonly cardId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly entity?: TimelineEntity | null;
}
export interface TimelineNote {
  readonly id: string;
  readonly cardId: string;
  readonly createdAt: number;
  readonly body: string;
}
export type TimelineEntry =
  | {
      readonly id: string;
      readonly source: 'system';
      readonly kind: TimelineEventType;
      readonly occurredAt: number;
      readonly entity: TimelineEntity | null;
      readonly data: SafeTimelineMetadata;
    }
  | {
      readonly id: string;
      readonly source: 'note';
      readonly kind: 'note';
      readonly occurredAt: number;
      readonly entity: TimelineEntity;
      readonly data: { readonly body: string };
    };
/** Confronto binario senza locale; source completa l'ordine in caso di ID uguali fra fonti. */
export function compareTimelineEntries(a: TimelineEntry, b: TimelineEntry): number {
  return (
    b.occurredAt - a.occurredAt ||
    (a.id === b.id
      ? a.source < b.source
        ? 1
        : a.source > b.source
          ? -1
          : 0
      : a.id < b.id
        ? 1
        : -1)
  );
}
export function mergeTimeline(
  events: readonly TimelineSystemEvent[],
  notes: readonly TimelineNote[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = events.map((event) => {
    const data = safeTimelineMetadata(event.type, event.metadata);
    const interviewId = typeof data['interviewId'] === 'string' ? data['interviewId'] : null;
    return {
      id: event.id,
      source: 'system',
      kind: event.type,
      occurredAt: event.occurredAt,
      data,
      entity:
        event.entity !== undefined
          ? event.entity
            ? { type: event.entity.type, id: event.entity.id }
            : null
          : interviewId
            ? { type: 'interview', id: interviewId }
            : event.cardId
              ? { type: 'card', id: event.cardId }
              : null,
    };
  });
  for (const note of notes)
    entries.push({
      id: note.id,
      source: 'note',
      kind: 'note',
      occurredAt: note.createdAt,
      entity: { type: 'note', id: note.id },
      data: { body: note.body },
    });
  const unique = new Map<string, TimelineEntry>();
  for (const entry of entries) {
    const identity = JSON.stringify([entry.source, entry.id]);
    const previous = unique.get(identity);
    if (previous && JSON.stringify(previous) !== JSON.stringify(entry))
      throw new Error('timeline_identity_conflict');
    unique.set(identity, entry);
  }
  return [...unique.values()].sort(compareTimelineEntries);
}
export const EXISTING_TIMELINE_EVENT_TYPES: readonly ActivityEventType[] = ACTIVITY_EVENT_TYPES;
