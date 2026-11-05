import type { ActivityEvent } from '@jobward/schemas';
import {
  OUTCOMES,
  PRIORITIES,
  STAGES,
  type Outcome,
  type Priority,
  type Stage,
} from '@jobward/shared';
import { formatInterviewDate } from '@/features/interviews/time';
import { formatCalendarDate, formatDateTime } from '@/lib/format';
import { INTERVIEW_RESULT_LABELS } from '@/lib/labels';
import { OUTCOME_LABELS, PRIORITY_LABELS, STAGE_LABELS } from '@/lib/labels';

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const priority = (value: unknown): string => {
  const text = asString(value);
  return text && (PRIORITIES as readonly string[]).includes(text)
    ? PRIORITY_LABELS[text as Priority].toLowerCase()
    : '—';
};

const stage = (value: unknown): string => {
  const text = asString(value);
  return text && (STAGES as readonly string[]).includes(text)
    ? `“${STAGE_LABELS[text as Stage]}”`
    : 'nessuna fase';
};
const outcome = (value: unknown): string => {
  const text = asString(value);
  return text && (OUTCOMES as readonly string[]).includes(text)
    ? `“${OUTCOME_LABELS[text as Outcome]}”`
    : '—';
};

const round = (value: unknown): string => (typeof value === 'number' ? `Round ${value}` : 'Round');

/** Frase leggibile per un evento. I metadati sono dati strutturati minimi (ADR-0004). */
export function describeEvent(event: ActivityEvent, timeZone = 'UTC'): string {
  const m = event.metadata;
  switch (event.type) {
    case 'card_created': {
      const column = asString(m['columnName']);
      return column ? `Scheda creata in “${column}”` : 'Scheda creata';
    }
    case 'card_moved': {
      const from = asString(m['fromColumnName']);
      const to = asString(m['toColumnName']);
      return from && to
        ? `Spostata da “${from}” a “${to}”`
        : to
          ? `Spostata in “${to}”`
          : 'Scheda spostata';
    }
    case 'priority_changed':
      return `Priorità cambiata da ${priority(m['from'])} a ${priority(m['to'])}`;
    case 'stage_changed':
      return m['from']
        ? `Fase cambiata da ${stage(m['from'])} a ${stage(m['to'])}`
        : `Fase impostata su ${stage(m['to'])}`;
    case 'application_submitted': {
      const date = formatCalendarDate(asString(m['appliedOn']));
      return date ? `Candidatura registrata (${date})` : 'Candidatura registrata';
    }
    case 'application_closed':
      return `Esito registrato: ${outcome(m['outcome'])}`;
    case 'interview_created':
    case 'interview_next_round_created': {
      const n = round(m['sequence']);
      const when =
        typeof m['scheduledAt'] === 'number'
          ? ` per ${formatInterviewDate(m['scheduledAt'], null, timeZone, { short: true })}`
          : '';
      return event.type === 'interview_next_round_created'
        ? `Fase successiva aggiunta: ${n}${when}`
        : `Colloquio aggiunto: ${n}${when}`;
    }
    case 'interview_rescheduled': {
      const n = round(m['sequence']);
      const to =
        typeof m['to'] === 'number'
          ? formatInterviewDate(m['to'], null, timeZone, { short: true })
          : null;
      if (to === null) return `${n}: data rimossa, da programmare`;
      return typeof m['from'] === 'number'
        ? `${n} riprogrammato per ${to}`
        : `${n} programmato per ${to}`;
    }
    case 'interview_completed': {
      const r = asString(m['result']);
      const label =
        r && r in INTERVIEW_RESULT_LABELS
          ? `, esito ${INTERVIEW_RESULT_LABELS[r as keyof typeof INTERVIEW_RESULT_LABELS].toLowerCase()}`
          : '';
      return `${round(m['sequence'])} completato${label}`;
    }
    case 'interview_cancelled':
      return `${round(m['sequence'])} annullato`;
    case 'interview_feedback_recorded':
      return `Feedback registrato per ${round(m['sequence'])}`;
    case 'card_archived':
      return 'Scheda archiviata';
    case 'card_restored':
      return 'Scheda ripristinata';
    default:
      return 'Aggiornamento';
  }
}

/** Cronologia essenziale, dal più recente. Gli orari sono nel fuso del workspace. */
export function CardHistory({ events, timeZone }: { events: ActivityEvent[]; timeZone: string }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Nessun evento registrato.</p>;
  }
  return (
    <ol className="space-y-2.5 border-l border-border pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative text-sm">
          <span
            aria-hidden="true"
            className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-border-strong"
          />
          <p>{describeEvent(event, timeZone)}</p>
          <time
            className="text-xs text-muted-foreground"
            dateTime={new Date(event.occurredAt).toISOString()}
          >
            {formatDateTime(event.occurredAt, timeZone)}
          </time>
        </li>
      ))}
    </ol>
  );
}
