import type { Card, Interview } from '@jobward/schemas';
import { INTERVIEW_RESULTS, LIMITS, type InterviewResult } from '@jobward/shared';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useDirtyReporter } from '@/features/cards/dirty-guard';
import { userMessage } from '@/features/kanban/mutations';
import { useWorkspace } from '@/features/workspace/context';
import { ApiRequestError } from '@/lib/api';
import {
  INTERVIEW_MODALITY_LABELS,
  INTERVIEW_RESULT_LABELS,
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_TYPE_LABELS,
  STAGE_LABELS,
} from '@/lib/labels';
import { useInterviewActions, useInterviews } from './api';
import { InterviewForm } from './interview-form';
import {
  formatInterviewDate,
  instantToLocalInput,
  localInputToInstant,
  timeZoneOptions,
} from './time';

type Panel =
  | { kind: 'create'; followUpOf?: string }
  | { kind: 'edit' | 'reschedule' | 'complete' | 'feedback'; id: string }
  | null;

const STATUS_TONE = {
  to_schedule: 'warning',
  scheduled: 'primary',
  completed: 'neutral',
  cancelled: 'neutral',
} as const;
const RESULT_TONE = { positive: 'primary', neutral: 'neutral', negative: 'danger' } as const;

/** Stati in cui si può ancora programmare o concludere il round. */
const isOpen = (i: Interview) => i.status === 'to_schedule' || i.status === 'scheduled';

/**
 * Scheda «Colloqui»: tutti i round della candidatura, nell'ordine stabile del loro numero.
 * Ogni azione è un'operazione completa con il suo stato di caricamento e il suo errore; nulla
 * cambia colonna, fase o esito generale della candidatura (l'unico suggerimento — «Imposta la fase
 * Colloquio» — è un'azione esplicita).
 */
export function InterviewsTab({
  card,
  archived,
  createSignal,
  stagePending,
  onSetStage,
}: {
  card: Card;
  archived: boolean;
  /** Incrementato da fuori (intestazione, riepilogo) per aprire il modulo «nuovo colloquio». */
  createSignal: number;
  stagePending: boolean;
  onSetStage: () => void;
}) {
  const { workspace } = useWorkspace();
  const notify = useNotify();
  const interviews = useInterviews(card.id);
  const actions = useInterviewActions(card.id);
  const [panel, setPanel] = useState<Panel>(null);
  const [seenSignal, setSeenSignal] = useState(createSignal);
  const [cancelling, setCancelling] = useState<Interview | null>(null);

  if (createSignal !== seenSignal) {
    setSeenSignal(createSignal);
    if (!archived) setPanel({ kind: 'create' });
  }

  const list = interviews.data ?? [];
  const nextSeq = (list.at(-1)?.sequence ?? 0) + 1;
  const live = list.filter((i) => i.status !== 'cancelled');
  const suggestStage =
    live.length > 0 &&
    !archived &&
    (!card.stage || ['saved', 'preparing', 'applied', 'in_contact'].includes(card.stage));

  const close = () => setPanel(null);
  const done = (message: string) => () => {
    close();
    notify('success', message);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {list.length === 0
            ? 'Registra i round di selezione di questa candidatura.'
            : `${live.length} ${live.length === 1 ? 'round' : 'round'} attiv${live.length === 1 ? 'o' : 'i'}${list.length > live.length ? `, ${list.length - live.length} annullat${list.length - live.length === 1 ? 'o' : 'i'}` : ''}.`}
        </p>
        {!archived ? (
          <Button onClick={() => setPanel({ kind: 'create' })}>
            <Plus aria-hidden="true" />
            Aggiungi colloquio
          </Button>
        ) : null}
      </div>

      {archived ? (
        <p
          role="status"
          className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground"
        >
          La candidatura è archiviata: lo storico dei colloqui si conserva, ripristinala per
          modificarlo.
        </p>
      ) : null}

      {suggestStage ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <span>
            Ci sono colloqui, ma la fase è «{card.stage ? STAGE_LABELS[card.stage] : 'non indicata'}
            ». Non la cambio da solo.
          </span>
          <Button variant="secondary" size="sm" disabled={stagePending} onClick={onSetStage}>
            {stagePending ? 'Salvataggio…' : 'Imposta la fase «Colloquio»'}
          </Button>
        </div>
      ) : null}

      {panel?.kind === 'create' ? (
        <InterviewForm
          key={panel.followUpOf ?? 'new'}
          mode="create"
          interview={null}
          workspaceZone={workspace.timezone}
          {...(panel.followUpOf ? { followUpOf: panel.followUpOf } : {})}
          suggestedTitle={`Round ${nextSeq}`}
          onSave={async (payload) => {
            await actions.create.mutateAsync(
              payload as Parameters<typeof actions.create.mutateAsync>[0],
            );
            done(panel.followUpOf ? 'Fase successiva aggiunta.' : 'Colloquio aggiunto.')();
          }}
          onCancel={close}
        />
      ) : null}

      {interviews.isPending ? (
        <div role="status" aria-label="Caricamento dei colloqui" className="space-y-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : interviews.isError ? (
        <p role="alert" className="text-sm text-danger">
          Non riusciamo a caricare i colloqui.{' '}
          <button type="button" className="underline" onClick={() => void interviews.refetch()}>
            Riprova
          </button>
        </p>
      ) : list.length === 0 ? (
        panel?.kind === 'create' ? null : (
          <div className="rounded-lg border border-dashed border-border-strong px-6 py-10 text-center">
            <h3 className="text-base font-semibold">Nessun colloquio registrato</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Aggiungi un round quando hai un appuntamento o una fase da seguire. Puoi averne quanti
              ne servono e annotare feedback dopo ciascuno.
            </p>
          </div>
        )
      ) : (
        <ol aria-label="Round di colloquio" className="space-y-3">
          {list.map((interview) => (
            <li key={interview.id}>
              <InterviewItem
                interview={interview}
                cardArchived={archived}
                zone={workspace.timezone}
                panel={panel?.kind !== 'create' && panel?.id === interview.id ? panel.kind : null}
                onPanel={(kind) => setPanel(kind ? { kind, id: interview.id } : null)}
                onFollowUp={() => setPanel({ kind: 'create', followUpOf: interview.id })}
                onCancel={() => setCancelling(interview)}
                onSaved={done}
                actions={actions}
              />
            </li>
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCancelling(null);
            actions.cancel.reset();
          }
        }}
        title={`Annullare “${cancelling?.title ?? ''}”?`}
        description={
          <p>
            Il round resta nello storico come «Annullato» e non sarà più il prossimo appuntamento.
            Non cambia la fase né l’esito della candidatura.
          </p>
        }
        confirmLabel="Annulla il colloquio"
        cancelLabel="Mantieni il colloquio"
        pending={actions.cancel.isPending}
        error={
          actions.cancel.error
            ? userMessage(actions.cancel.error, 'Qualcosa è andato storto. Riprova.')
            : null
        }
        onConfirm={() =>
          cancelling &&
          actions.cancel.mutate(cancelling.id, {
            onSuccess: () => {
              setCancelling(null);
              notify('success', 'Colloquio annullato.');
            },
          })
        }
      />
    </div>
  );
}

type Actions = ReturnType<typeof useInterviewActions>;

function InterviewItem({
  interview,
  cardArchived,
  zone,
  panel,
  onPanel,
  onFollowUp,
  onCancel,
  onSaved,
  actions,
}: {
  interview: Interview;
  cardArchived: boolean;
  zone: string;
  panel: 'edit' | 'reschedule' | 'complete' | 'feedback' | null;
  onPanel: (kind: 'edit' | 'reschedule' | 'complete' | 'feedback' | null) => void;
  onFollowUp: () => void;
  onCancel: () => void;
  onSaved: (message: string) => () => void;
  actions: Actions;
}) {
  const open = isOpen(interview);
  const editable = !cardArchived && interview.status !== 'cancelled';
  const when =
    interview.scheduledAt !== null
      ? formatInterviewDate(interview.scheduledAt, interview.timezone, zone)
      : null;
  const where = [
    interview.modality ? INTERVIEW_MODALITY_LABELS[interview.modality] : null,
    interview.location,
    interview.durationMinutes ? `${interview.durationMinutes} min` : null,
  ].filter(Boolean);

  return (
    <article
      aria-label={`Round ${interview.sequence}: ${interview.title}`}
      className={`rounded-lg border p-4 ${interview.status === 'cancelled' ? 'border-border bg-surface-muted/50' : 'border-border bg-surface'}`}
    >
      <header className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground"
        >
          {interview.sequence}
        </span>
        <div className="min-w-0 flex-1">
          <h3
            className={`text-sm font-semibold break-words ${interview.status === 'cancelled' ? 'line-through' : ''}`}
          >
            {interview.title}
          </h3>
          <p className="text-xs text-muted-foreground">{INTERVIEW_TYPE_LABELS[interview.type]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={STATUS_TONE[interview.status]}>
            {INTERVIEW_STATUS_LABELS[interview.status]}
          </Badge>
          {interview.result ? (
            <Badge tone={RESULT_TONE[interview.result]}>
              Esito: {INTERVIEW_RESULT_LABELS[interview.result].toLowerCase()}
            </Badge>
          ) : null}
        </div>
      </header>

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {when ? (
          <div>
            <dt className="text-xs text-muted-foreground">
              {interview.status === 'completed' ? 'Si è svolto' : 'Quando'}
            </dt>
            <dd>
              <time dateTime={new Date(interview.scheduledAt as number).toISOString()}>{when}</time>
            </dd>
          </div>
        ) : null}
        {where.length > 0 ? (
          <div>
            <dt className="text-xs text-muted-foreground">Dove</dt>
            <dd>{where.join(' · ')}</dd>
          </div>
        ) : null}
        {interview.interviewers.length > 0 ? (
          <div>
            <dt className="text-xs text-muted-foreground">Con</dt>
            <dd>{interview.interviewers.join(', ')}</dd>
          </div>
        ) : null}
        {interview.meetingUrl ? (
          <div>
            <dt className="text-xs text-muted-foreground">Collegamento</dt>
            <dd>
              <a
                href={interview.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-2"
              >
                Apri la riunione<span className="sr-only"> (si apre in una nuova scheda)</span>
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
      {interview.preparationNotes ? (
        <div className="mt-3">
          <h4 className="text-xs text-muted-foreground">Preparazione</h4>
          <p className="text-sm whitespace-pre-wrap">{interview.preparationNotes}</p>
        </div>
      ) : null}
      {interview.feedbackNotes ? (
        <div className="mt-3">
          <h4 className="text-xs text-muted-foreground">Feedback</h4>
          <p className="text-sm whitespace-pre-wrap">{interview.feedbackNotes}</p>
        </div>
      ) : null}

      {editable && panel === null ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {open ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => onPanel('reschedule')}>
                {interview.status === 'scheduled' ? 'Riprogramma' : 'Programma'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onPanel('complete')}>
                Segna come completato
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => onPanel('feedback')}>
                {interview.feedbackNotes || interview.result
                  ? 'Modifica il feedback'
                  : 'Aggiungi feedback'}
              </Button>
              <Button variant="secondary" size="sm" onClick={onFollowUp}>
                Aggiungi fase successiva
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => onPanel('edit')}>
            Modifica
          </Button>
          {open ? (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Annulla il colloquio
            </Button>
          ) : null}
        </div>
      ) : null}

      {panel === 'edit' ? (
        <div className="mt-3">
          <InterviewForm
            mode="edit"
            interview={interview}
            workspaceZone={zone}
            suggestedTitle={`Round ${interview.sequence}`}
            onSave={async (payload) => {
              await actions.update.mutateAsync({ id: interview.id, input: payload });
              onSaved('Colloquio aggiornato.')();
            }}
            onCancel={() => onPanel(null)}
          />
        </div>
      ) : null}
      {panel === 'reschedule' ? (
        <RescheduleForm
          interview={interview}
          zone={zone}
          onCancel={() => onPanel(null)}
          onSave={async (input) => {
            await actions.update.mutateAsync({ id: interview.id, input });
            onSaved(input.scheduledAt === null ? 'Data rimossa.' : 'Colloquio programmato.')();
          }}
        />
      ) : null}
      {panel === 'complete' || panel === 'feedback' ? (
        <FeedbackForm
          interview={interview}
          mode={panel}
          onCancel={() => onPanel(null)}
          onSave={async (values) => {
            if (panel === 'complete') {
              await actions.complete.mutateAsync({ id: interview.id, input: values });
              onSaved('Colloquio completato.')();
            } else {
              await actions.update.mutateAsync({ id: interview.id, input: values });
              onSaved('Feedback salvato.')();
            }
          }}
        />
      ) : null}
    </article>
  );
}

function useSaving() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (onSave: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await onSave();
    } catch (e) {
      setError(
        e instanceof ApiRequestError && e.status >= 400 && e.status < 500
          ? e.message
          : 'Non siamo riusciti a salvare. Riprova.',
      );
    } finally {
      setPending(false);
    }
  };
  return { pending, error, setError, run };
}

function RescheduleForm({
  interview,
  zone,
  onCancel,
  onSave,
}: {
  interview: Interview;
  zone: string;
  onCancel: () => void;
  onSave: (input: { scheduledAt: number | null; timezone?: string }) => Promise<void>;
}) {
  const tz0 = interview.timezone ?? zone;
  const initial =
    interview.scheduledAt !== null ? instantToLocalInput(interview.scheduledAt, tz0) : '';
  const [local, setLocal] = useState(initial);
  const [tz, setTz] = useState(tz0);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const instant = local ? localInputToInstant(local, tz) : null;
  const dirty = local !== initial || tz !== tz0;
  useDirtyReporter(`reschedule:${interview.id}`, dirty);
  const saving = useSaving();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!local || instant === null) {
      setFieldError('Indica data e ora');
      return;
    }
    setFieldError(null);
    void saving.run(() => onSave({ scheduledAt: instant, timezone: tz }));
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mt-3 space-y-3 rounded-lg border border-border-strong bg-surface-muted/40 p-3"
    >
      <h4 className="text-sm font-semibold">
        {interview.status === 'scheduled' ? 'Riprogramma' : 'Programma'}
      </h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id={`rs-${interview.id}-when`}
          label="Nuova data e ora"
          error={fieldError ?? undefined}
        >
          <Input
            id={`rs-${interview.id}-when`}
            type="datetime-local"
            value={local}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? `rs-${interview.id}-when-error` : undefined}
            onChange={(e) => setLocal(e.target.value)}
          />
        </Field>
        <Field id={`rs-${interview.id}-tz`} label="Fuso orario">
          <Select id={`rs-${interview.id}-tz`} value={tz} onChange={(e) => setTz(e.target.value)}>
            {timeZoneOptions(tz0).map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {saving.error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {saving.error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={saving.pending}>
          Annulla
        </Button>
        {interview.status === 'scheduled' ? (
          <Button
            variant="secondary"
            disabled={saving.pending}
            onClick={() => void saving.run(() => onSave({ scheduledAt: null }))}
          >
            Togli la data
          </Button>
        ) : null}
        <Button type="submit" disabled={saving.pending || !dirty}>
          {saving.pending ? 'Salvataggio…' : 'Salva la data'}
        </Button>
      </div>
    </form>
  );
}

function FeedbackForm({
  interview,
  mode,
  onCancel,
  onSave,
}: {
  interview: Interview;
  mode: 'complete' | 'feedback';
  onCancel: () => void;
  onSave: (values: {
    result: InterviewResult | null;
    feedbackNotes: string | null;
  }) => Promise<void>;
}) {
  const [result, setResult] = useState<string>(interview.result ?? '');
  const [notes, setNotes] = useState(interview.feedbackNotes ?? '');
  const dirty = result !== (interview.result ?? '') || notes !== (interview.feedbackNotes ?? '');
  useDirtyReporter(`feedback:${interview.id}`, dirty);
  const saving = useSaving();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void saving.run(() =>
          onSave({
            result: (result || null) as InterviewResult | null,
            feedbackNotes: notes.trim() || null,
          }),
        );
      }}
      noValidate
      className="mt-3 space-y-3 rounded-lg border border-border-strong bg-surface-muted/40 p-3"
    >
      <h4 className="text-sm font-semibold">
        {mode === 'complete' ? 'Completa il colloquio' : 'Feedback'}
      </h4>
      <Field
        id={`fb-${interview.id}-result`}
        label="Come è andato (esito di questo round)"
        hint="È indipendente dall'esito generale della candidatura."
      >
        <Select
          id={`fb-${interview.id}-result`}
          value={result}
          aria-describedby={`fb-${interview.id}-result-hint`}
          onChange={(e) => setResult(e.target.value)}
        >
          <option value="">Non indicato</option>
          {INTERVIEW_RESULTS.map((r) => (
            <option key={r} value={r}>
              {INTERVIEW_RESULT_LABELS[r]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id={`fb-${interview.id}-notes`} label="Feedback e appunti">
        <Textarea
          id={`fb-${interview.id}-notes`}
          value={notes}
          maxLength={LIMITS.descriptionMax}
          className="min-h-28"
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      {saving.error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {saving.error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={saving.pending}>
          Annulla
        </Button>
        <Button type="submit" disabled={saving.pending || (mode === 'feedback' && !dirty)}>
          {saving.pending
            ? 'Salvataggio…'
            : mode === 'complete'
              ? 'Segna come completato'
              : 'Salva feedback'}
        </Button>
      </div>
    </form>
  );
}
