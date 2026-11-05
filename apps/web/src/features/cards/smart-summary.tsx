import type { Card } from '@jobward/schemas';
import { STAGES, type Stage } from '@jobward/shared';
import { CalendarClock, ListTodo, Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { formatInterviewDate } from '@/features/interviews/time';
import { formatCalendarDate } from '@/lib/format';
import {
  INTERVIEW_MODALITY_LABELS,
  INTERVIEW_TYPE_LABELS,
  OUTCOME_LABELS,
  STAGE_LABELS,
  WORK_MODE_LABELS,
} from '@/lib/labels';
import { formatSalary } from '@/lib/salary';

const ACTION_TEXT = {
  overdue: (title: string) => `Aggiorna “${title}”: la data è trascorsa`,
  record_feedback: (title: string) => `Registra il feedback di “${title}”`,
  schedule: (title: string) => `Programma “${title}”`,
} as const;

/**
 * Riepilogo intelligente in cima alla Panoramica. Mostra SOLO dati registrati: nessun evento
 * inventato, nessuna stima. La «prossima azione» discende dai colloqui (docs/m25/interview-domain.md).
 */
export function SmartSummary({
  card,
  timeZone,
  disabled,
  stagePending,
  onSetStage,
  onOpenInterviews,
  onAddInterview,
}: {
  card: Card;
  timeZone: string;
  disabled: boolean;
  stagePending: boolean;
  onSetStage: (stage: Stage) => void;
  onOpenInterviews: () => void;
  onAddInterview: () => void;
}) {
  const [nextStage, setNextStage] = useState<string>('');
  const { next, action, total, completed } = card.interviewSummary;
  const salary = formatSalary(card);
  const facts = [
    salary ? { label: 'Retribuzione', value: salary } : null,
    card.location || card.workMode
      ? {
          label: 'Sede',
          value: [card.location, card.workMode ? WORK_MODE_LABELS[card.workMode] : null]
            .filter(Boolean)
            .join(' · '),
        }
      : null,
    card.appliedOn
      ? { label: 'Candidatura inviata', value: formatCalendarDate(card.appliedOn) }
      : null,
  ].filter((f): f is { label: string; value: string | null } => f !== null);

  return (
    <section aria-label="Riepilogo" className="grid gap-3 md:grid-cols-2">
      <div className="rounded-lg border border-border p-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Fase
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium">
          {card.stage ? STAGE_LABELS[card.stage] : 'Non indicata'}
          {card.outcome ? <Badge>{OUTCOME_LABELS[card.outcome]}</Badge> : null}
        </p>
        {!disabled ? (
          <div className="mt-2 flex items-center gap-2">
            <Select
              aria-label="Passaggio del percorso (aggiornamento rapido)"
              value={nextStage}
              onChange={(e) => setNextStage(e.target.value)}
            >
              <option value="">Aggiorna fase…</option>
              {STAGES.filter((s) => s !== card.stage).map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              disabled={!nextStage || stagePending}
              onClick={() => {
                onSetStage(nextStage as Stage);
                setNextStage('');
              }}
            >
              {stagePending ? 'Salvataggio…' : 'Aggiorna'}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-border p-3">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <CalendarClock aria-hidden="true" className="size-3.5" />
          Prossimo colloquio
        </h3>
        {next ? (
          <>
            <p className="mt-1 text-sm font-medium">
              {formatInterviewDate(next.scheduledAt, next.timezone, timeZone)}
            </p>
            <p className="text-xs text-muted-foreground">
              {next.title} · {INTERVIEW_TYPE_LABELS[next.type]}
              {next.modality ? ` · ${INTERVIEW_MODALITY_LABELS[next.modality]}` : ''}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Nessun colloquio programmato.</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {total > 0 ? (
            <Button variant="secondary" size="sm" onClick={onOpenInterviews}>
              {total === 1 ? 'Vedi il round' : `Vedi i ${total} round`} ({completed} completat
              {completed === 1 ? 'o' : 'i'})
            </Button>
          ) : null}
          {!disabled ? (
            <Button variant="secondary" size="sm" onClick={onAddInterview}>
              <Plus aria-hidden="true" />
              Aggiungi colloquio
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-border p-3">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <ListTodo aria-hidden="true" className="size-3.5" />
          Prossima azione
        </h3>
        {action ? (
          <>
            <p className="mt-1 text-sm font-medium">{ACTION_TEXT[action.kind](action.title)}</p>
            <Button className="mt-2" variant="secondary" size="sm" onClick={onOpenInterviews}>
              Apri i colloqui
            </Button>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Nessuna azione in sospeso.</p>
        )}
      </div>

      <div className="rounded-lg border border-border p-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          In breve
        </h3>
        {facts.length > 0 ? (
          <dl className="mt-1 space-y-0.5 text-sm">
            {facts.map((f) => (
              <div key={f.label} className="flex gap-2">
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className="font-medium">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Nessun dettaglio registrato.</p>
        )}
      </div>
    </section>
  );
}
