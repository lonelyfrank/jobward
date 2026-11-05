import { describe, expect, it } from 'vitest';
import { OUTCOMES, STAGES, type Outcome, type Stage } from './constants';
import {
  derivePipelineStatus,
  inspectPipelineState,
  resolvePipelineFields,
  PIPELINE_STATUSES,
  type PipelineStatus,
} from './pipeline';

const outcomeStatus: Record<Outcome, PipelineStatus> = {
  pending: 'saved',
  accepted: 'hired',
  rejected: 'rejected',
  withdrawn: 'withdrawn',
  no_response: 'no_response',
  offer_declined: 'withdrawn',
};
const stageStatus: Record<Stage, PipelineStatus> = {
  saved: 'saved',
  preparing: 'saved',
  applied: 'applied',
  in_contact: 'screening',
  interviewing: 'interviewing',
  offer: 'offer',
  closed: 'saved',
};
const cases = ([null, ...STAGES] as const).flatMap((stage) =>
  ([null, ...OUTCOMES] as const).flatMap((outcome) =>
    [null, 0].map((archivedAt) => ({ stage, outcome, archivedAt })),
  ),
);
describe('derivazione completa della pipeline', () => {
  it.each(cases)('$stage / $outcome / archivio $archivedAt', (state) => {
    const expected =
      state.archivedAt !== null
        ? 'archived'
        : state.outcome && state.outcome !== 'pending'
          ? outcomeStatus[state.outcome]
          : state.stage
            ? stageStatus[state.stage]
            : 'saved';
    const frozen = Object.freeze({ ...state });
    expect(derivePipelineStatus(frozen)).toBe(expected);
    expect(PIPELINE_STATUSES).toContain(expected);
    expect(frozen).toEqual(state);
  });
  it.each([null, 'pending'] as const)(
    'closed senza esito (%s) non inventa una conclusione',
    (outcome) => {
      expect(inspectPipelineState({ stage: 'closed', outcome, archivedAt: null })).toEqual({
        status: 'saved',
        issues: ['closed_without_outcome'],
      });
    },
  );
  it.each(PIPELINE_STATUSES.filter((status) => status !== 'archived'))(
    'mapping esplicito e round-trip: %s',
    (status) => {
      const fields = resolvePipelineFields(status);
      expect(derivePipelineStatus({ ...fields, archivedAt: null })).toBe(status);
      expect(Object.keys(fields).sort()).toEqual(['outcome', 'stage']);
    },
  );
  it('non usa colonne Kanban, colloqui o clock per derivare lo stato', () => {
    const state = { stage: null, outcome: null, archivedAt: null } as const;
    expect(derivePipelineStatus(state)).toBe('saved');
    expect(inspectPipelineState(state).issues).toEqual([]);
    expect(derivePipelineStatus({ ...state, outcome: 'accepted', stage: 'saved' })).toBe('hired');
  });
});
