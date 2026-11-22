import type { Outcome, Stage } from './constants';

export const PIPELINE_STATUSES = [
  'saved',
  'applied',
  'screening',
  'interviewing',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
  'no_response',
  'archived',
] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];
export type ActivePipelineStatus = Exclude<PipelineStatus, 'archived'>;
export type PipelineTransitionKind = 'advance' | 'close' | 'reopen' | 'correction';
export interface PipelineState {
  readonly stage: Stage | null;
  readonly outcome: Outcome | null;
  readonly archivedAt: number | null;
}
export const OPEN_PIPELINE_STATUSES = [
  'saved',
  'applied',
  'screening',
  'interviewing',
  'offer',
] as const;
export const CLOSED_PIPELINE_STATUSES = ['hired', 'rejected', 'withdrawn', 'no_response'] as const;
export function isClosedPipelineStatus(status: PipelineStatus): boolean {
  return (CLOSED_PIPELINE_STATUSES as readonly PipelineStatus[]).includes(status);
}

/** Legge esclusivamente dati espliciti; closed senza esito ha fallback neutro + diagnostica. */
export function derivePipelineStatus(state: PipelineState): PipelineStatus {
  if (state.archivedAt !== null) return 'archived';
  switch (state.outcome) {
    case 'accepted':
      return 'hired';
    case 'rejected':
      return 'rejected';
    case 'withdrawn':
    case 'offer_declined':
      return 'withdrawn';
    case 'no_response':
      return 'no_response';
  }
  switch (state.stage) {
    case 'applied':
      return 'applied';
    case 'in_contact':
      return 'screening';
    case 'interviewing':
      return 'interviewing';
    case 'offer':
      return 'offer';
    case 'closed':
    case 'saved':
    case 'preparing':
    case null:
      return 'saved';
  }
}

export function inspectPipelineState(state: PipelineState): {
  status: PipelineStatus;
  issues: readonly 'closed_without_outcome'[];
} {
  return {
    status: derivePipelineStatus(state),
    issues:
      state.stage === 'closed' && (state.outcome === null || state.outcome === 'pending')
        ? ['closed_without_outcome']
        : [],
  };
}

/** Mappa canonica per una modifica esplicita; nessun backfill o scrittura automatica. */
export function resolvePipelineFields(status: ActivePipelineStatus): {
  stage: Stage;
  outcome: Outcome;
} {
  switch (status) {
    case 'saved':
      return { stage: 'saved', outcome: 'pending' };
    case 'applied':
      return { stage: 'applied', outcome: 'pending' };
    case 'screening':
      return { stage: 'in_contact', outcome: 'pending' };
    case 'interviewing':
      return { stage: 'interviewing', outcome: 'pending' };
    case 'offer':
      return { stage: 'offer', outcome: 'pending' };
    case 'hired':
      return { stage: 'closed', outcome: 'accepted' };
    case 'rejected':
      return { stage: 'closed', outcome: 'rejected' };
    case 'withdrawn':
      return { stage: 'closed', outcome: 'withdrawn' };
    case 'no_response':
      return { stage: 'closed', outcome: 'no_response' };
  }
}
