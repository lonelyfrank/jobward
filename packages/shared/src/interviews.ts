import type { InterviewModality, InterviewStatus, InterviewType } from './constants';

/** Proiezione pura, senza note private e senza dipendenze dal validatore o dal runtime. */
export interface InterviewSummary {
  total: number;
  completed: number;
  next: {
    id: string;
    sequence: number;
    title: string;
    type: InterviewType;
    scheduledAt: number;
    timezone: string | null;
    modality: InterviewModality | null;
  } | null;
  action: {
    kind: 'overdue' | 'record_feedback' | 'schedule';
    interviewId: string;
    sequence: number;
    title: string;
  } | null;
}

/** Riga minima da cui si calcola il riepilogo (nessuna nota). */
export interface InterviewSummaryRow {
  id: string;
  sequence: number;
  title: string;
  type: InterviewType;
  status: InterviewStatus;
  scheduledAt: number | null;
  timezone: string | null;
  modality: InterviewModality | null;
  hasFeedback: boolean;
}

/** Regole del riepilogo in una funzione pura: stesse per server, test e (se serve) client. */
export function summarizeInterviews(
  rows: readonly InterviewSummaryRow[],
  now: number,
): InterviewSummary {
  const live = rows.filter((r) => r.status !== 'cancelled');
  const bySeq = [...live].sort((a, b) => a.sequence - b.sequence);
  const upcoming = bySeq
    .filter((r) => r.status === 'scheduled' && r.scheduledAt !== null && r.scheduledAt >= now)
    .sort(
      (a, b) => (a.scheduledAt as number) - (b.scheduledAt as number) || a.sequence - b.sequence,
    )[0];
  const overdue = bySeq.find(
    (r) => r.status === 'scheduled' && r.scheduledAt !== null && r.scheduledAt < now,
  );
  const missingFeedback = [...bySeq]
    .reverse()
    .find((r) => r.status === 'completed' && !r.hasFeedback);
  const toSchedule = bySeq.find((r) => r.status === 'to_schedule');
  const pick = overdue
    ? ({ kind: 'overdue', row: overdue } as const)
    : missingFeedback
      ? ({ kind: 'record_feedback', row: missingFeedback } as const)
      : toSchedule
        ? ({ kind: 'schedule', row: toSchedule } as const)
        : null;
  return {
    total: live.length,
    completed: live.filter((r) => r.status === 'completed').length,
    next: upcoming
      ? {
          id: upcoming.id,
          sequence: upcoming.sequence,
          title: upcoming.title,
          type: upcoming.type,
          scheduledAt: upcoming.scheduledAt as number,
          timezone: upcoming.timezone,
          modality: upcoming.modality,
        }
      : null,
    action: pick
      ? {
          kind: pick.kind,
          interviewId: pick.row.id,
          sequence: pick.row.sequence,
          title: pick.row.title,
        }
      : null,
  };
}
