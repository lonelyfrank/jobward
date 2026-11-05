import { describe, expect, it } from 'vitest';
import type { InterviewSummaryRow } from './interviews';
import { summarizeInterviews } from './interviews';
import { createPipelineInterviewContext, pipelineConsistency } from './pipeline-consistency';

const row = (overrides: Partial<InterviewSummaryRow> = {}): InterviewSummaryRow => ({
  id: 'round',
  sequence: 1,
  title: 'Private title',
  type: 'technical',
  status: 'scheduled',
  scheduledAt: 200,
  timezone: 'UTC',
  modality: 'video',
  hasFeedback: false,
  ...overrides,
});
describe('coerenza: segnalazioni senza cambiare candidature o colloqui', () => {
  it.each(['saved', 'applied', 'screening'] as const)(
    'round registrati su %s suggeriscono In colloqui',
    (status) => {
      expect(
        pipelineConsistency(status, createPipelineInterviewContext([row()], 100)),
      ).toContainEqual({ code: 'consider_interviewing', suggestedStatus: 'interviewing' });
    },
  );
  it.each(['hired', 'rejected', 'withdrawn', 'no_response'] as const)(
    'appuntamento su %s produce avviso',
    (status) => {
      expect(
        pipelineConsistency(status, createPipelineInterviewContext([row()], 100)),
      ).toContainEqual({ code: 'future_interviews_on_closed', interviewId: 'round' });
    },
  );
  it('i round annullati non diventano appuntamenti, round attivi o feedback mancante', () => {
    const context = createPipelineInterviewContext([row({ status: 'cancelled' })], 100);
    expect(context.summary.total).toBe(0);
    expect(pipelineConsistency('saved', context)).toEqual([]);
    expect(pipelineConsistency('interviewing', context)).toEqual([
      { code: 'interviewing_without_rounds' },
    ]);
  });
  it('completato senza feedback e programmato scaduto restano distinti dalla pipeline', () => {
    expect(
      pipelineConsistency(
        'interviewing',
        createPipelineInterviewContext([row({ status: 'completed' })], 100),
      ),
    ).toContainEqual({ code: 'interview_needs_feedback', interviewId: 'round' });
    expect(
      pipelineConsistency('interviewing', createPipelineInterviewContext([row()], 300)),
    ).toContainEqual({ code: 'interview_overdue', interviewId: 'round' });
    expect(
      pipelineConsistency(
        'interviewing',
        createPipelineInterviewContext([row({ status: 'to_schedule', scheduledAt: null })], 100),
      ),
    ).toContainEqual({ code: 'interview_needs_schedule', interviewId: 'round' });
  });
  it('riusa il riepilogo M2.5, con input congelati e clock esplicito', () => {
    const rows = Object.freeze([
      Object.freeze(row()),
      Object.freeze(row({ id: 'second', sequence: 2, status: 'completed', hasFeedback: true })),
    ]);
    const snapshot = JSON.stringify(rows);
    const context = createPipelineInterviewContext(rows, 100);
    expect(context.summary).toEqual(summarizeInterviews(rows, 100));
    expect(pipelineConsistency('archived', context)).toEqual([]);
    expect(JSON.stringify(rows)).toBe(snapshot);
    expect(JSON.stringify(pipelineConsistency('saved', context))).not.toContain('Private');
  });
});
