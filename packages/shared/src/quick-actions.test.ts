import { describe, expect, it } from 'vitest';
import { quickActions } from './quick-actions';
import { summarizeInterviews, type InterviewSummaryRow } from './interviews';

const empty = summarizeInterviews([], 100);
describe('azioni contestuali ordinate senza gestori UI', () => {
  it.each([
    ['saved', ['mark_applied', 'edit_info']],
    ['applied', ['add_interview', 'log_update', 'prepare_followup']],
    ['screening', ['add_interview', 'log_update', 'prepare_followup']],
    ['interviewing', ['add_interview', 'log_update']],
    ['offer', ['view_offer', 'record_decision']],
    ['hired', ['reopen', 'correct_status']],
    ['rejected', ['reopen', 'correct_status']],
    ['withdrawn', ['reopen', 'correct_status']],
    ['no_response', ['reopen', 'correct_status']],
    ['archived', ['restore']],
  ] as const)('%s → azioni previste', (status, actions) => {
    expect(quickActions({ status, summary: empty })).toEqual(actions);
  });
  it('appuntamento e feedback hanno priorità e non duplicano gli identificatori', () => {
    const rows: InterviewSummaryRow[] = [
      {
        id: 'first',
        sequence: 1,
        title: 'Private',
        type: 'other',
        status: 'completed',
        scheduledAt: 0,
        timezone: null,
        modality: null,
        hasFeedback: false,
      },
      {
        id: 'next',
        sequence: 2,
        title: 'Private',
        type: 'other',
        status: 'scheduled',
        scheduledAt: 200,
        timezone: null,
        modality: null,
        hasFeedback: false,
      },
    ];
    const summary = summarizeInterviews(rows, 100);
    const before = JSON.stringify(summary);
    Object.freeze(summary);
    const actions = quickActions({ status: 'interviewing', summary });
    expect(actions[0]).toBe('add_feedback');
    expect(actions).toEqual(
      expect.arrayContaining([
        'open_interview',
        'complete_interview',
        'schedule_next_round',
        'record_result',
      ]),
    );
    expect(new Set(actions).size).toBe(actions.length);
    expect(JSON.stringify(summary)).toBe(before);
    expect(quickActions({ status: 'archived', summary })).toEqual(['restore']);
    expect(quickActions({ status: 'rejected', summary })).toEqual(['reopen', 'correct_status']);
  });
  it('note presenti consentono un aggiornamento contestuale', () => {
    expect(quickActions({ status: 'saved', summary: empty, hasNotes: true })).toEqual([
      'mark_applied',
      'edit_info',
      'log_update',
    ]);
  });
});
