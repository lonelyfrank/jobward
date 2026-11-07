import type { Task, TaskAsOf } from '@jobward/schemas';
import {
  classifyDue,
  completedLate,
  daysBetween,
  localDate,
  type TaskDue,
  type TaskKind,
} from '@jobward/shared';
import { formatCalendarDate } from '@/lib/format';

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  general: 'Attività',
  follow_up: 'Follow-up',
  preparation: 'Preparazione',
};
export const TASK_KIND_DESCRIPTIONS: Record<TaskKind, string> = {
  general: 'Qualsiasi cosa da fare',
  follow_up: 'Ricontattare o sollecitare una risposta',
  preparation: 'Prepararsi a un colloquio o a un test',
};

export type DueTone = 'overdue' | 'today' | 'upcoming' | 'neutral';
export interface DueDescriptor {
  text: string;
  /** Data estesa per gli screen reader e per il tooltip, quando il testo è relativo. */
  full: string | null;
  tone: DueTone;
  due: TaskDue | 'done' | 'cancelled';
}

/** Terminologia comprensibile: mai timestamp tecnici. «Oggi» è la data del SERVER (asOf). */
export function describeDue(task: Task, asOf: TaskAsOf): DueDescriptor {
  const full = task.dueOn ? formatCalendarDate(task.dueOn) : null;
  if (task.status === 'done' && task.completedAt !== null) {
    const when = formatCalendarDate(localDate(task.completedAt, asOf.timeZone));
    const late = completedLate(task.dueOn, task.completedAt, asOf.timeZone);
    return {
      text: `Completata il ${when}${late ? ' (in ritardo)' : ''}`,
      full,
      tone: 'neutral',
      due: 'done',
    };
  }
  if (task.status === 'cancelled' && task.cancelledAt !== null) {
    const when = formatCalendarDate(localDate(task.cancelledAt, asOf.timeZone));
    return { text: `Annullata il ${when}`, full, tone: 'neutral', due: 'cancelled' };
  }
  const due = classifyDue(task.dueOn, task.status, asOf.today);
  const days = task.dueOn ? daysBetween(asOf.today, task.dueOn) : 0;
  switch (due) {
    case 'overdue':
      return {
        text: days === -1 ? 'Scaduta ieri' : `Scaduta da ${-days} giorni`,
        full,
        tone: 'overdue',
        due,
      };
    case 'today':
      return { text: 'Oggi', full, tone: 'today', due };
    case 'soon':
      return { text: days === 1 ? 'Domani' : `Tra ${days} giorni`, full, tone: 'upcoming', due };
    case 'later':
      return { text: full ?? '', full: null, tone: 'neutral', due };
    default:
      return { text: 'Senza scadenza', full: null, tone: 'neutral', due };
  }
}

/** Sezioni dell'elenco operativo, derivate dalla classificazione (mai salvate). */
export const TASK_SECTIONS = ['overdue', 'today', 'upcoming', 'none', 'done'] as const;
export type TaskSection = (typeof TASK_SECTIONS)[number];
export const TASK_SECTION_LABELS: Record<TaskSection, string> = {
  overdue: 'In ritardo',
  today: 'Oggi',
  upcoming: 'Prossime',
  none: 'Senza scadenza',
  done: 'Completate',
};
export function sectionOf(task: Task, asOf: TaskAsOf): TaskSection | null {
  if (task.status === 'done') return 'done';
  if (task.status === 'cancelled') return null;
  const due = classifyDue(task.dueOn, task.status, asOf.today);
  return due === 'overdue'
    ? 'overdue'
    : due === 'today'
      ? 'today'
      : due === 'none'
        ? 'none'
        : 'upcoming';
}

/** Vista ↔ parametro d'indirizzo (italiano, leggibile). */
export const VIEW_PARAMS = {
  all: 'tutte',
  open: 'da-fare',
  done: 'completate',
  overdue: 'in-ritardo',
  no_due: 'senza-scadenza',
  cancelled: 'annullate',
} as const;
export const VIEW_LABELS = {
  all: 'Tutte',
  open: 'Da fare',
  done: 'Completate',
  overdue: 'In ritardo',
  no_due: 'Senza scadenza',
  cancelled: 'Annullate',
} as const;
