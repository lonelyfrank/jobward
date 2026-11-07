import type { InterviewStatus, TaskKind, TaskStatus } from './constants';
import { isClosedPipelineStatus, type PipelineStatus } from './pipeline';
import { addDays, daysBetween, localDate } from './tasks';

/**
 * Suggerimenti contestuali (M3 Tasks): calcolati da dati reali e SEMPRE deterministici. Non creano
 * nulla: restituiscono una proposta che l'utente può trasformare in una Task con un'azione esplicita
 * (e che non modifica mai la candidatura). Nessun orologio interno: `today` è un argomento.
 */

export const SUGGESTION_WINDOW_DAYS = 7;

export type TaskSuggestionRule = 'S1' | 'S2' | 'S3';
export interface TaskSuggestion {
  /** Stabile per «Non ora»: `regola:ancora` (data di invio o id del colloquio). */
  readonly key: string;
  readonly rule: TaskSuggestionRule;
  readonly kind: TaskKind;
  readonly title: string;
  readonly dueOn: string;
  readonly interviewId: string | null;
}

export interface SuggestionTask {
  kind: TaskKind;
  status: TaskStatus;
  createdAt: number;
}
export interface SuggestionInterview {
  id: string;
  sequence: number;
  status: InterviewStatus;
  scheduledAt: number | null;
  completedAt: number | null;
  createdAt: number;
}
export interface SuggestionContext {
  status: PipelineStatus;
  appliedOn: string | null;
  company: string | null;
  tasks: readonly SuggestionTask[];
  interviews: readonly SuggestionInterview[];
  today: string;
  timeZone: string;
  dismissed?: ReadonlySet<string>;
}

const maxDate = (a: string, b: string) => (a >= b ? a : b);

/**
 * Regole (docs/m3/tasks-product-spec.md §8):
 *  S1 follow-up dopo l'invio · S2 preparazione di un colloquio programmato entro 7 giorni ·
 *  S3 follow-up dopo un colloquio completato negli ultimi 7 giorni.
 * «Nessuna task in alcuno stato» (anche annullata) vale come decisione già presa: non si ripropone.
 * Al più UNA proposta, con priorità S3 > S2 > S1; mai per candidature archiviate o chiuse.
 */
export function suggestTasks(ctx: SuggestionContext): TaskSuggestion[] {
  if (ctx.status === 'archived' || isClosedPipelineStatus(ctx.status)) return [];
  const dismissed = ctx.dismissed ?? new Set<string>();
  const label = ctx.company?.trim() ? ctx.company.trim() : 'candidatura';
  const found: TaskSuggestion[] = [];

  const lastCompleted = [...ctx.interviews]
    .filter((i) => i.status === 'completed' && i.completedAt !== null)
    .sort(
      (a, b) => (b.completedAt as number) - (a.completedAt as number) || b.sequence - a.sequence,
    )[0];
  if (lastCompleted) {
    const completedAt = lastCompleted.completedAt as number;
    const age = daysBetween(localDate(completedAt, ctx.timeZone), ctx.today);
    const covered = ctx.tasks.some((t) => t.kind === 'follow_up' && t.createdAt >= completedAt);
    if (age >= 0 && age <= SUGGESTION_WINDOW_DAYS && !covered) {
      found.push({
        key: `S3:${lastCompleted.id}`,
        rule: 'S3',
        kind: 'follow_up',
        title: `Follow-up dopo il colloquio: round ${lastCompleted.sequence}`,
        dueOn: addDays(ctx.today, 2),
        interviewId: lastCompleted.id,
      });
    }
  }

  const upcoming = [...ctx.interviews]
    .filter((i) => i.status === 'scheduled' && i.scheduledAt !== null)
    .map((i) => ({ i, day: localDate(i.scheduledAt as number, ctx.timeZone) }))
    .filter(({ day }) => {
      const ahead = daysBetween(ctx.today, day);
      return ahead >= 0 && ahead <= SUGGESTION_WINDOW_DAYS;
    })
    .sort(
      (a, b) =>
        (a.i.scheduledAt as number) - (b.i.scheduledAt as number) || a.i.sequence - b.i.sequence,
    );
  for (const { i, day } of upcoming) {
    const covered = ctx.tasks.some((t) => t.kind === 'preparation' && t.createdAt >= i.createdAt);
    if (covered) continue;
    found.push({
      key: `S2:${i.id}`,
      rule: 'S2',
      kind: 'preparation',
      title: `Prepara il colloquio: round ${i.sequence}`,
      dueOn: maxDate(ctx.today, addDays(day, -1)),
      interviewId: i.id,
    });
    break;
  }

  if (
    (ctx.status === 'applied' || ctx.status === 'screening') &&
    !ctx.tasks.some((t) => t.kind === 'follow_up')
  ) {
    found.push({
      key: `S1:${ctx.appliedOn ?? 'none'}`,
      rule: 'S1',
      kind: 'follow_up',
      title: `Follow-up: ${label}`,
      dueOn: ctx.appliedOn ? maxDate(addDays(ctx.appliedOn, 7), ctx.today) : addDays(ctx.today, 7),
      interviewId: null,
    });
  }

  const priority: Record<TaskSuggestionRule, number> = { S3: 0, S2: 1, S1: 2 };
  const first = found
    .filter((s) => !dismissed.has(s.key))
    .sort((a, b) => priority[a.rule] - priority[b.rule])[0];
  return first ? [first] : [];
}
