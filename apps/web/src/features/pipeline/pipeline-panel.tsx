import { pipelineTransitionInput, type Card, type PipelineTransitionInput } from '@jobward/schemas';
import {
  CLOSED_PIPELINE_STATUSES,
  derivePipelineStatus,
  evaluatePipelineTransition,
  inspectPipelineState,
  pipelineConsistency,
  type PipelineStatus,
  type PipelineTransitionKind,
} from '@jobward/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { useCreationOperation } from '@/features/cards/creation-operation';
import { useDirtyReporter } from '@/features/cards/dirty-guard';
import { refreshWorkflow } from '@/features/cards/workflow-cache';
import { workflowError } from '@/features/cards/workflow-feedback';
import { useTasks } from '@/features/tasks/api';
import { useWorkspace } from '@/features/workspace/context';
import { cn } from '@/lib/cn';
import { OUTCOME_LABELS, STAGE_LABELS } from '@/lib/labels';
import { usePipeline } from './api';
import { KIND_LABELS, STATUS_LABELS, WARNING_TEXT, pipelineOptions } from './presentation';

/** Le cinque tappe mostrate nello stepper: gli stati intermedi si raggruppano nella tappa giusta. */
const STEPS: { label: string; statuses: readonly PipelineStatus[] }[] = [
  { label: 'Salvata', statuses: ['saved'] },
  { label: 'Candidata', statuses: ['applied', 'screening'] },
  { label: 'Colloquio', statuses: ['interviewing'] },
  { label: 'Offerta', statuses: ['offer'] },
  { label: 'Chiusa', statuses: CLOSED_PIPELINE_STATUSES },
];

const STATUS_TONE: Record<PipelineStatus, 'neutral' | 'info' | 'success' | 'danger' | 'warning'> = {
  saved: 'neutral',
  applied: 'info',
  screening: 'info',
  interviewing: 'info',
  offer: 'success',
  hired: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
  no_response: 'neutral',
  archived: 'warning',
};

/**
 * Stato della candidatura (pannello a destra della modale): stato attuale, tappe del processo e le
 * azioni della pipeline. Ogni passaggio apre la conferma: fase ed esito non cambiano mai senza.
 * `signal` (dai Colloqui) propone direttamente il passaggio a «In colloquio».
 */
export function PipelinePanel({
  card,
  signal = 0,
  disabled = false,
}: {
  card: Card;
  signal?: number;
  disabled?: boolean;
}) {
  const [seenSignal, setSeenSignal] = useState(signal);
  const [operation, setOperation] = useState<{
    kind: PipelineTransitionKind;
    to: PipelineStatus;
  } | null>(null);
  const [result, setResult] = useState<string[]>([]);
  if (signal !== seenSignal) {
    setSeenSignal(signal);
    const kind = pipelineOptions(card, 'advance').includes('interviewing')
      ? 'advance'
      : 'correction';
    if (pipelineOptions(card, kind).includes('interviewing'))
      setOperation({ kind, to: 'interviewing' });
  }
  const status = derivePipelineStatus(card);
  // Le tappe seguono fase ed esito anche per una scheda archiviata.
  const flow = derivePipelineStatus({ ...card, archivedAt: null });
  const current = STEPS.findIndex((step) => step.statuses.includes(flow));
  const warnings = pipelineConsistency(status, { summary: card.interviewSummary });
  const issues = inspectPipelineState(card).issues;
  const options = (kind: PipelineTransitionKind) => (disabled ? [] : pipelineOptions(card, kind));
  const open = (kind: PipelineTransitionKind) => (to: PipelineStatus) => setOperation({ kind, to });
  const advance = options('advance');
  const reopen = options('reopen');
  const close = options('close');
  const correction = options('correction');

  return (
    <section
      aria-labelledby={`pipeline-${card.id}`}
      className="rounded-2xl bg-surface p-4 shadow-xs"
    >
      <h2
        id={`pipeline-${card.id}`}
        className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
      >
        Stato candidatura
      </h2>
      <p className="mt-2.5">
        <Badge
          tone={STATUS_TONE[status]}
          data-testid="pipeline-status"
          className="h-8 gap-2 px-3.5 text-sm"
        >
          <span aria-hidden="true" className="size-2 rounded-full bg-current" />
          {STATUS_LABELS[status]}
        </Badge>
      </p>
      <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <div className="flex gap-1">
          <dt>Fase:</dt>
          <dd data-testid="card-stage" className="font-medium text-foreground">
            {card.stage ? STAGE_LABELS[card.stage] : 'Non indicata'}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Esito:</dt>
          <dd data-testid="card-outcome" className="font-medium text-foreground">
            {card.outcome ? OUTCOME_LABELS[card.outcome] : 'Non indicato'}
          </dd>
        </div>
      </dl>

      <ol aria-label="Tappe della candidatura" className="mt-3 mb-1">
        {STEPS.map((step, i) => {
          const done = current > i;
          const now = current === i;
          return (
            <li
              key={step.label}
              aria-current={now ? 'step' : undefined}
              className={cn(
                'flex h-7.5 items-center gap-2.5 text-[13px] text-muted-foreground',
                done && 'text-foreground',
                now && 'font-bold text-primary-soft-foreground',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-4 shrink-0 place-items-center rounded-full border-2 border-border-strong',
                  done && 'border-primary bg-primary text-primary-foreground',
                  now && 'border-primary bg-primary-soft ring-3 ring-primary-soft',
                )}
              >
                {done ? <Check className="size-2.5" strokeWidth={3} /> : null}
                {now ? <span className="size-1.5 rounded-full bg-primary" /> : null}
              </span>
              {step.label}
              {now && i === STEPS.length - 1 ? (
                <span className="font-medium text-muted-foreground">· {STATUS_LABELS[flow]}</span>
              ) : null}
              {done || now ? null : <span className="sr-only"> (da fare)</span>}
            </li>
          );
        })}
      </ol>

      {issues.length > 0 ? (
        <p role="status" className="mt-2 text-xs text-warning-soft-foreground">
          La fase «Chiusa» non ha un esito. Usa «Correggi stato» per allineare i dati.
        </p>
      ) : null}
      {warnings.length ? (
        <ul className="mt-2 space-y-1 text-xs text-warning-soft-foreground">
          {warnings.map((w) => (
            <li key={w.code}>{WARNING_TEXT[w.code] ?? 'Controlla i dati della candidatura.'}</li>
          ))}
        </ul>
      ) : null}

      {advance.length > 0 || reopen.length > 0 ? (
        <TransitionMenu
          kind={advance.length > 0 ? 'advance' : 'reopen'}
          options={advance.length > 0 ? advance : reopen}
          onPick={open(advance.length > 0 ? 'advance' : 'reopen')}
          primary
        />
      ) : null}
      {close.length > 0 ? (
        <TransitionMenu kind="close" options={close} onPick={open('close')} />
      ) : null}
      {correction.length > 0 ? (
        <TransitionMenu kind="correction" options={correction} onPick={open('correction')} />
      ) : null}

      {result.length > 0 ? (
        <div role="status" className="mt-3 space-y-1 text-xs">
          {result.map((message, i) => (
            <p key={i}>{message}</p>
          ))}
        </div>
      ) : null}
      {operation ? (
        <PipelineConfirmation
          card={card}
          kind={operation.kind}
          to={operation.to}
          onClose={() => setOperation(null)}
          onDone={(messages) => {
            setResult(messages);
            setOperation(null);
          }}
        />
      ) : null}
    </section>
  );
}

/** Un'azione della pipeline: il pulsante apre l'elenco degli stati raggiungibili. */
function TransitionMenu({
  kind,
  options,
  onPick,
  primary = false,
}: {
  kind: PipelineTransitionKind;
  options: PipelineStatus[];
  onPick: (to: PipelineStatus) => void;
  primary?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={primary ? 'primary' : 'ghost'}
          size="sm"
          className={cn(
            'w-full gap-1.5 rounded-lg px-3 text-[13px] [&_svg]:size-3.5',
            primary
              ? 'mt-3 h-9'
              : 'mt-0.5 h-8 font-medium text-primary-soft-foreground hover:bg-primary-soft',
          )}
        >
          {KIND_LABELS[kind]}
          {primary ? <ArrowRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuLabel>{kind === 'correction' ? 'Correggi in' : 'Passa a'}</DropdownMenuLabel>
        {options.map((to) => (
          <DropdownMenuItem key={to} data-status={to} onSelect={() => onPick(to)}>
            {kind === 'advance' && to === 'applied' ? 'Segna come candidata' : STATUS_LABELS[to]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PipelineConfirmation({
  card,
  kind,
  to,
  onClose,
  onDone,
}: {
  card: Card;
  kind: PipelineTransitionKind;
  to: PipelineStatus;
  onClose: () => void;
  onDone: (messages: string[]) => void;
}) {
  const [original] = useState(card);
  const operation = useCreationOperation<PipelineTransitionInput>();
  const mutation = usePipeline(card);
  const client = useQueryClient();
  const { workspace } = useWorkspace();
  const notify = useNotify();
  const [handling, setHandling] = useState<'keep' | 'cancel'>('keep');
  const linkedTasks = useTasks({ view: 'open', cardId: card.id }, kind === 'close');
  const linkedCount = linkedTasks.data?.pages.reduce((n, p) => n + p.tasks.length, 0) ?? 0;
  const [appliedOn, setAppliedOn] = useState('');
  const [validation, setValidation] = useState<string | null>(null);
  const from = derivePipelineStatus(original);
  const changed =
    card.stage !== original.stage ||
    card.outcome !== original.outcome ||
    card.archivedAt !== original.archivedAt;
  const decision = evaluatePipelineTransition({
    current: original,
    kind,
    to,
    cardId: card.id,
    operationId: operation.id,
    interviews: { summary: original.interviewSummary },
  });
  useDirtyReporter('pipeline-operation', mutation.isPending || operation.locked);
  const confirm = async () => {
    const parsed = pipelineTransitionInput.safeParse({
      id: operation.id,
      kind,
      to,
      expectedFrom: from,
      ...(to === 'applied' && appliedOn ? { appliedOn } : {}),
      ...(decision.allowed && decision.confirmation.manageFutureInterviews
        ? { futureInterviews: handling }
        : {}),
    });
    if (!parsed.success) {
      setValidation(parsed.error.issues.map((i) => i.message).join(' · '));
      return;
    }
    try {
      const response = await mutation.mutateAsync(operation.capture(parsed.data));
      notify(
        'success',
        response.replayed
          ? 'Operazione già registrata: dati aggiornati.'
          : 'Stato della candidatura aggiornato.',
      );
      onDone([
        ...(response.cancelledInterviews
          ? [`${response.cancelledInterviews} colloqui futuri annullati; lo storico è conservato.`]
          : []),
        ...response.warnings.map((w) => {
          if (w.code === 'manage_future_interviews') {
            return response.cancelledInterviews > 0
              ? 'Hai annullato i colloqui futuri programmati.'
              : handling === 'keep'
                ? 'Hai conservato i colloqui futuri programmati.'
                : 'Nessun colloquio futuro da annullare al momento della conferma.';
          }
          return WARNING_TEXT[w.code] ?? 'Controlla i dati della candidatura.';
        }),
      ]);
    } catch (error) {
      operation.failed(error);
    }
  };
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={KIND_LABELS[kind]}
      pending={mutation.isPending}
      confirmDisabled={operation.conflict || (changed && !operation.locked) || !decision.allowed}
      confirmLabel={operation.locked ? 'Riprova la stessa richiesta' : 'Conferma passaggio'}
      error={validation ?? (mutation.error ? workflowError(mutation.error) : null)}
      description={
        <>
          <p>
            Da «{STATUS_LABELS[from]}» a «{STATUS_LABELS[to]}».
          </p>
          <p>
            {kind === 'correction'
              ? 'Corregge fase ed esito e registra la correzione nella Timeline.'
              : kind === 'reopen'
                ? 'Riapre la candidatura, conserva i dati e registra la riapertura nella Timeline.'
                : 'Aggiorna fase ed esito e registra il passaggio nella Timeline.'}
          </p>
          {decision.allowed
            ? decision.warnings.map((w) => (
                <p key={w.code}>{WARNING_TEXT[w.code] ?? 'Controlla i dati della candidatura.'}</p>
              ))
            : null}
          {kind === 'close' && linkedCount > 0 ? (
            <p data-testid="linked-tasks-notice">
              Hai {linkedCount}
              {linkedTasks.hasNextPage ? ' o più' : ''}{' '}
              {linkedCount === 1 && !linkedTasks.hasNextPage
                ? 'attività aperta collegata'
                : 'attività aperte collegate'}
              . Restano valide: la chiusura non le completa né le annulla.{' '}
              <Link
                to={`/tasks?candidatura=${encodeURIComponent(card.id)}`}
                className="font-medium text-primary underline"
              >
                Vedile
              </Link>
            </p>
          ) : null}
          {decision.allowed && decision.confirmation.manageFutureInterviews ? (
            <fieldset disabled={operation.locked || mutation.isPending} className="space-y-2">
              <legend className="font-medium">Colloqui futuri</legend>
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name="future-interviews"
                  checked={handling === 'keep'}
                  onChange={() => setHandling('keep')}
                />
                Conserva i colloqui programmati
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name="future-interviews"
                  checked={handling === 'cancel'}
                  onChange={() => setHandling('cancel')}
                />
                Annulla i colloqui futuri programmati
              </label>
              <p>
                Si annullano solo gli appuntamenti programmati con data futura. I round da
                programmare e lo storico restano.
              </p>
            </fieldset>
          ) : (
            <p>I colloqui vengono conservati.</p>
          )}
          {to === 'applied' && !original.appliedOn ? (
            <Field id="pipeline-applied-on" label="Data di invio (facoltativa)">
              <Input
                id="pipeline-applied-on"
                type="date"
                value={appliedOn}
                disabled={operation.locked}
                onChange={(e) => {
                  setAppliedOn(e.target.value);
                  setValidation(null);
                }}
              />
            </Field>
          ) : null}
          {changed && !operation.locked ? (
            <p role="alert">
              Lo stato remoto è cambiato. Annulla e scegli un nuovo passaggio dai dati aggiornati.
            </p>
          ) : null}
          {operation.conflict ? (
            <Button
              variant="secondary"
              className="h-auto min-h-11 w-full whitespace-normal"
              onClick={() => {
                void refreshWorkflow(client, workspace.id, card.id, card.boardId, 'interviews')
                  .then(onClose)
                  .catch((e: unknown) => setValidation(workflowError(e)));
              }}
            >
              Aggiorna i dati e scegli una nuova operazione
            </Button>
          ) : null}
        </>
      }
      onConfirm={() => {
        if ((!changed || operation.locked) && !operation.conflict && decision.allowed)
          void confirm();
      }}
    />
  );
}
