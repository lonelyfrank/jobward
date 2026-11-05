import type { InterviewSummary } from './interviews';
import { isClosedPipelineStatus, type PipelineStatus } from './pipeline';

export type QuickActionId =
  | 'mark_applied'
  | 'edit_info'
  | 'add_interview'
  | 'log_update'
  | 'prepare_followup'
  | 'open_interview'
  | 'edit_interview'
  | 'complete_interview'
  | 'add_feedback'
  | 'schedule_next_round'
  | 'record_result'
  | 'view_offer'
  | 'record_decision'
  | 'reopen'
  | 'correct_status'
  | 'restore';
export interface QuickActionsContext {
  readonly status: PipelineStatus;
  readonly summary: InterviewSummary;
  readonly hasNotes?: boolean;
}
/** Solo identificatori per i gestori futuri C3: non crea UI o scritture simulate. */
export function quickActions({
  status,
  summary,
  hasNotes = false,
}: QuickActionsContext): QuickActionId[] {
  if (status === 'archived') return ['restore'];
  if (isClosedPipelineStatus(status)) return ['reopen', 'correct_status'];
  const actions: QuickActionId[] = [];
  if (summary.action?.kind === 'overdue')
    actions.push('open_interview', 'edit_interview', 'complete_interview');
  if (summary.action?.kind === 'schedule') actions.push('open_interview', 'edit_interview');
  if (summary.action?.kind === 'record_feedback') actions.push('add_feedback');
  if (summary.next) actions.push('open_interview', 'edit_interview', 'complete_interview');
  if (summary.completed > 0) actions.push('schedule_next_round', 'record_result');
  switch (status) {
    case 'saved':
      actions.push('mark_applied', 'edit_info');
      break;
    case 'applied':
    case 'screening':
      actions.push('add_interview', 'log_update', 'prepare_followup');
      break;
    case 'interviewing':
      actions.push('add_interview', 'log_update');
      break;
    case 'offer':
      actions.push('view_offer', 'record_decision');
      break;
  }
  if (hasNotes && !actions.includes('log_update')) actions.push('log_update');
  return [...new Set(actions)];
}
