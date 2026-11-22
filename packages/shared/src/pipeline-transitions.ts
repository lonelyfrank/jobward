import {
  derivePipelineStatus,
  inspectPipelineState,
  isClosedPipelineStatus,
  OPEN_PIPELINE_STATUSES,
  CLOSED_PIPELINE_STATUSES,
  PIPELINE_STATUSES,
  resolvePipelineFields,
  type PipelineState,
  type PipelineStatus,
  type PipelineTransitionKind,
} from './pipeline';
import {
  pipelineConsistency,
  type PipelineInterviewContext,
  type PipelineConsistencyWarning,
} from './pipeline-consistency';
import { pipelineEventIntent, type PipelineEventIntent } from './timeline';

type TransitionGraph = Readonly<
  Record<PipelineStatus, Readonly<Record<PipelineTransitionKind, readonly PipelineStatus[]>>>
>;
/** Ogni array è congelato: la UI non può alterare le regole per altri consumer. */
export const PIPELINE_TRANSITIONS: TransitionGraph = Object.freeze(
  Object.fromEntries(
    PIPELINE_STATUSES.map((status) => {
      const index = (OPEN_PIPELINE_STATUSES as readonly PipelineStatus[]).indexOf(status);
      const archived = status === 'archived';
      return [
        status,
        Object.freeze({
          advance: Object.freeze(index < 0 ? [] : OPEN_PIPELINE_STATUSES.slice(index + 1)),
          close: Object.freeze(
            index < 0
              ? []
              : CLOSED_PIPELINE_STATUSES.filter((to) => to !== 'hired' || status === 'offer'),
          ),
          reopen: Object.freeze(isClosedPipelineStatus(status) ? [...OPEN_PIPELINE_STATUSES] : []),
          correction: Object.freeze(
            archived ? [] : PIPELINE_STATUSES.filter((to) => to !== 'archived'),
          ),
        }),
      ];
    }),
  ) as Record<PipelineStatus, TransitionGraph[PipelineStatus]>,
);

export function allowedTransitions(
  status: PipelineStatus,
  kind?: PipelineTransitionKind,
): PipelineStatus[] {
  const graph = PIPELINE_TRANSITIONS[status];
  return kind
    ? [...graph[kind]]
    : [...new Set([...graph.advance, ...graph.close, ...graph.reopen])];
}
export interface PipelineTransitionRequest {
  readonly current: PipelineState;
  readonly to: PipelineStatus;
  readonly kind: PipelineTransitionKind;
  readonly cardId: string;
  readonly operationId: string;
  readonly expectedFrom?: PipelineStatus;
  readonly interviews?: PipelineInterviewContext;
}
export type PipelineTransitionDecision =
  | {
      readonly allowed: false;
      readonly reason:
        | 'archived'
        | 'target_archived'
        | 'stale_state'
        | 'invalid_transition'
        | 'unchanged'
        | 'missing_identity'
        | 'legacy_state_requires_correction';
    }
  | {
      readonly allowed: true;
      readonly from: PipelineStatus;
      readonly to: PipelineStatus;
      readonly kind: PipelineTransitionKind;
      readonly fields: ReturnType<typeof resolvePipelineFields>;
      readonly events: readonly PipelineEventIntent[];
      readonly confirmation: {
        readonly required: boolean;
        readonly kind: PipelineTransitionKind;
        readonly manageFutureInterviews: boolean;
        readonly defaultInterviewHandling: 'keep';
      };
      readonly warnings: readonly PipelineConsistencyWarning[];
    };
/** Decide senza I/O. L'adattatore C2 deve rivalidare e scrivere atomicamente con gli eventi. */
export function evaluatePipelineTransition(
  request: PipelineTransitionRequest,
): PipelineTransitionDecision {
  const { current, to, kind, cardId, operationId, interviews } = request;
  const from = derivePipelineStatus(current);
  if (from === 'archived') return { allowed: false, reason: 'archived' };
  if (to === 'archived') return { allowed: false, reason: 'target_archived' };
  if (!cardId.trim() || !operationId.trim()) return { allowed: false, reason: 'missing_identity' };
  if (request.expectedFrom !== undefined && request.expectedFrom !== from)
    return { allowed: false, reason: 'stale_state' };
  if (inspectPipelineState(current).issues.length > 0 && kind !== 'correction')
    return { allowed: false, reason: 'legacy_state_requires_correction' };
  if (!allowedTransitions(from, kind).includes(to))
    return { allowed: false, reason: 'invalid_transition' };
  const fields = resolvePipelineFields(to);
  if (
    from === to &&
    (kind !== 'correction' ||
      (current.stage === fields.stage && current.outcome === fields.outcome))
  )
    return { allowed: false, reason: 'unchanged' };
  const events: PipelineEventIntent[] = [];
  const add = (type: PipelineEventIntent['type'], metadata: PipelineEventIntent['metadata']) =>
    events.push(pipelineEventIntent(type, { cardId, operationId, kind, from, to, metadata }));
  if (current.stage !== fields.stage)
    add('stage_changed', { from: current.stage, to: fields.stage });
  if (to === 'applied' && from !== 'applied') add('application_submitted', {});
  if (isClosedPipelineStatus(from) && !isClosedPipelineStatus(to))
    add('application_reopened', { outcome: current.outcome });
  else if (isClosedPipelineStatus(to) && current.outcome !== fields.outcome)
    add('application_closed', { outcome: fields.outcome });
  if (events.length === 0 && kind === 'correction')
    add('stage_changed', {
      from: current.stage,
      to: fields.stage,
      fromOutcome: current.outcome,
      toOutcome: fields.outcome,
    });
  const closing = isClosedPipelineStatus(to) && !isClosedPipelineStatus(from);
  return {
    allowed: true,
    from,
    to,
    kind,
    fields,
    events,
    confirmation: {
      required: kind !== 'advance',
      kind,
      manageFutureInterviews: closing && interviews?.summary.next != null,
      defaultInterviewHandling: 'keep',
    },
    warnings: interviews ? pipelineConsistency(to, { ...interviews, closing }) : [],
  };
}
