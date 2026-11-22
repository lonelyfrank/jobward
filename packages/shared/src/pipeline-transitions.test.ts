import { describe, expect, it } from 'vitest';
import {
  PIPELINE_STATUSES,
  resolvePipelineFields,
  derivePipelineStatus,
  type PipelineState,
  type PipelineStatus,
  type PipelineTransitionKind,
} from './pipeline';
import {
  allowedTransitions,
  evaluatePipelineTransition,
  PIPELINE_TRANSITIONS,
} from './pipeline-transitions';
import { createPipelineInterviewContext } from './pipeline-consistency';

const open = ['saved', 'applied', 'screening', 'interviewing', 'offer'];
const closed = ['hired', 'rejected', 'withdrawn', 'no_response'];
const stateFor = (status: PipelineStatus): PipelineState =>
  status === 'archived'
    ? { stage: 'offer', outcome: 'accepted', archivedAt: 0 }
    : { ...resolvePipelineFields(status), archivedAt: null };
const cases = PIPELINE_STATUSES.flatMap((from) =>
  PIPELINE_STATUSES.flatMap((to) =>
    (['advance', 'close', 'reopen', 'correction'] as const).map((kind) => ({ from, to, kind })),
  ),
);
describe('motore delle transizioni senza infrastruttura', () => {
  it('la normalizzazione esplicita di un esito nullo lascia una correzione identificabile', () => {
    const result = evaluatePipelineTransition({
      current: { stage: 'offer', outcome: null, archivedAt: null },
      to: 'offer',
      kind: 'correction',
      cardId: 'card',
      operationId: 'op',
    });
    expect(result.allowed).toBe(true);
    if (result.allowed)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          metadata: expect.objectContaining({
            kind: 'correction',
            fromOutcome: null,
            toOutcome: 'pending',
          }),
        }),
      );
  });
  it.each(cases)('$from → $to ($kind)', ({ from, to, kind }) => {
    const expected =
      from !== 'archived' &&
      to !== 'archived' &&
      from !== to &&
      (kind === 'correction' ||
        (kind === 'advance' && open.includes(from) && open.indexOf(to) > open.indexOf(from)) ||
        (kind === 'close' &&
          open.includes(from) &&
          closed.includes(to) &&
          (to !== 'hired' || from === 'offer')) ||
        (kind === 'reopen' && closed.includes(from) && open.includes(to)));
    const current = Object.freeze(stateFor(from));
    const request = Object.freeze({ current, to, kind, cardId: 'card', operationId: 'operation' });
    const decision = evaluatePipelineTransition(request);
    expect(decision.allowed).toBe(expected);
    expect(current).toEqual(stateFor(from));
    if (decision.allowed) {
      expect(derivePipelineStatus({ ...decision.fields, archivedAt: null })).toBe(to);
      expect(decision.confirmation.required).toBe(kind !== 'advance');
      expect(decision.confirmation.defaultInterviewHandling).toBe('keep');
      expect(decision.events.length).toBeGreaterThan(0);
      expect(decision.events.every((event) => event.metadata['kind'] === kind)).toBe(true);
    } else expect('fields' in decision).toBe(false);
  });
  it('controllo ottimistico e ID obbligatorio', () => {
    const base = {
      current: stateFor('offer'),
      to: 'hired',
      kind: 'close',
      cardId: 'card',
      operationId: 'op',
    } as const;
    expect(evaluatePipelineTransition({ ...base, expectedFrom: 'applied' })).toEqual({
      allowed: false,
      reason: 'stale_state',
    });
    expect(evaluatePipelineTransition({ ...base, operationId: '' })).toEqual({
      allowed: false,
      reason: 'missing_identity',
    });
  });
  it.each([null, 'pending'] as const)(
    'legacy closed/%s richiede correzione esplicita',
    (outcome) => {
      const base = {
        current: { stage: 'closed', outcome, archivedAt: null },
        cardId: 'card',
        operationId: 'op',
        to: 'saved',
      } as const;
      expect(evaluatePipelineTransition({ ...base, kind: 'advance' })).toEqual({
        allowed: false,
        reason: 'legacy_state_requires_correction',
      });
      const result = evaluatePipelineTransition({ ...base, kind: 'correction' });
      expect(result.allowed).toBe(true);
      if (result.allowed)
        expect(result.events).toContainEqual(
          expect.objectContaining({
            type: 'stage_changed',
            metadata: expect.objectContaining({ kind: 'correction' }),
          }),
        );
    },
  );
  it('riapertura: intenzione distinta e chiave stabile per operazione', () => {
    const request = {
      current: stateFor('rejected'),
      to: 'interviewing',
      kind: 'reopen',
      cardId: 'card',
      operationId: 'one',
    } as const;
    const first = evaluatePipelineTransition(request);
    expect(first).toEqual(evaluatePipelineTransition(request));
    expect(first.allowed).toBe(true);
    if (first.allowed) {
      expect(first.events.some((event) => event.type === 'application_reopened')).toBe(true);
      const second = evaluatePipelineTransition({ ...request, operationId: 'two' });
      if (second.allowed)
        expect(second.events.map((e) => e.dedupeKey)).not.toEqual(
          first.events.map((e) => e.dedupeKey),
        );
    }
  });
  it('chiusura con appuntamento: richiede una scelta, predefinito conserva', () => {
    const interviews = createPipelineInterviewContext(
      [
        {
          id: 'round',
          sequence: 1,
          title: 'Private',
          type: 'other',
          status: 'scheduled',
          scheduledAt: 200,
          timezone: null,
          modality: null,
          hasFeedback: false,
        },
      ],
      100,
    );
    const result = evaluatePipelineTransition({
      current: stateFor('offer'),
      to: 'hired',
      kind: 'close',
      cardId: 'card',
      operationId: 'op',
      interviews,
    });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.confirmation).toMatchObject({
        required: true,
        manageFutureInterviews: true,
        defaultInterviewHandling: 'keep',
      });
      expect(result.warnings).toContainEqual({
        code: 'manage_future_interviews',
        interviewId: 'round',
      });
      expect(JSON.stringify(result.events)).not.toContain('Private');
      expect('interviewUpdates' in result).toBe(false);
    }
  });
  it('il grafo è immutabile e le liste restituite sono indipendenti', () => {
    expect(Object.isFrozen(PIPELINE_TRANSITIONS)).toBe(true);
    expect(Object.isFrozen(PIPELINE_TRANSITIONS.saved.advance)).toBe(true);
    const copy = allowedTransitions('saved', 'advance');
    copy.length = 0;
    expect(allowedTransitions('saved', 'advance')).toEqual([
      'applied',
      'screening',
      'interviewing',
      'offer',
    ]);
    expect(allowedTransitions('archived')).toEqual([]);
    expect(allowedTransitions('saved')).not.toContain('hired');
    expect(allowedTransitions('saved', 'correction')).toContain('hired');
  });
  it.each(['advance', 'close', 'reopen', 'correction'] as const)(
    'nessuna modifica su archiviate: %s',
    (kind: PipelineTransitionKind) => {
      expect(
        evaluatePipelineTransition({
          current: stateFor('archived'),
          to: 'saved',
          kind,
          cardId: 'card',
          operationId: 'op',
        }),
      ).toEqual({ allowed: false, reason: 'archived' });
    },
  );
});
