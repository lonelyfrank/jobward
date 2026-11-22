import { summarizeInterviews, type InterviewSummary, type InterviewSummaryRow } from './interviews';
import { isClosedPipelineStatus, type PipelineStatus } from './pipeline';

export interface PipelineInterviewContext {
  readonly summary: InterviewSummary;
  /** Valutazione prima della chiusura: non annulla alcun colloquio. */
  readonly closing?: boolean;
}
export type PipelineConsistencyCode =
  | 'consider_interviewing'
  | 'future_interviews_on_closed'
  | 'manage_future_interviews'
  | 'interviewing_without_rounds'
  | 'interview_overdue'
  | 'interview_needs_feedback'
  | 'interview_needs_schedule';
export interface PipelineConsistencyWarning {
  readonly code: PipelineConsistencyCode;
  readonly interviewId?: string;
  readonly suggestedStatus?: 'interviewing';
}
export function createPipelineInterviewContext(
  rows: readonly InterviewSummaryRow[],
  now: number,
): PipelineInterviewContext {
  return { summary: summarizeInterviews(rows, now) };
}
export function pipelineConsistency(
  status: PipelineStatus,
  context: PipelineInterviewContext,
): PipelineConsistencyWarning[] {
  if (status === 'archived') return [];
  const { summary, closing } = context;
  const warnings: PipelineConsistencyWarning[] = [];
  if (
    ['saved', 'applied', 'screening'].includes(status) &&
    (summary.next !== null || summary.completed > 0 || summary.action?.kind === 'overdue')
  )
    warnings.push({ code: 'consider_interviewing', suggestedStatus: 'interviewing' });
  if (summary.next && closing)
    warnings.push({ code: 'manage_future_interviews', interviewId: summary.next.id });
  else if (summary.next && isClosedPipelineStatus(status))
    warnings.push({ code: 'future_interviews_on_closed', interviewId: summary.next.id });
  if (status === 'interviewing' && summary.total === 0)
    warnings.push({ code: 'interviewing_without_rounds' });
  if (summary.action) {
    const codes = {
      overdue: 'interview_overdue',
      record_feedback: 'interview_needs_feedback',
      schedule: 'interview_needs_schedule',
    } as const;
    warnings.push({ code: codes[summary.action.kind], interviewId: summary.action.interviewId });
  }
  return warnings;
}
