import type { ActivityEvent } from '@meet-roulette/schemas';
import {
  OUTCOMES,
  PRIORITIES,
  STAGES,
  type Outcome,
  type Priority,
  type Stage,
} from '@meet-roulette/shared';
import { formatCalendarDate, formatDateTime } from '@/lib/format';
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

/** Frase leggibile per un evento. I metadati sono dati strutturati minimi (ADR-0004). */
export function describeEvent(event: ActivityEvent): string {
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
          <p>{describeEvent(event)}</p>
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
