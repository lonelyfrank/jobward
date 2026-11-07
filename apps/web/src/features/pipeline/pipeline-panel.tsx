import { pipelineTransitionInput, type Card, type PipelineTransitionInput } from '@jobward/schemas';
import {
  derivePipelineStatus,
  evaluatePipelineTransition,
  inspectPipelineState,
  pipelineConsistency,
  type PipelineStatus,
  type PipelineTransitionKind,
} from '@jobward/shared';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { useCreationOperation } from '@/features/cards/creation-operation';
import { useDirtyReporter } from '@/features/cards/dirty-guard';
import { refreshWorkflow } from '@/features/cards/workflow-cache';
import { workflowError } from '@/features/cards/workflow-feedback';
import { useWorkspace } from '@/features/workspace/context';
import { usePipeline } from './api';
import { KIND_LABELS, STATUS_LABELS, WARNING_TEXT, pipelineOptions } from './presentation';

const KINDS = ['advance', 'close', 'reopen', 'correction'] as const;

export function PipelinePanel({ card, signal = 0 }: { card: Card; signal?: number }) {
  const [seenSignal, setSeenSignal] = useState(signal);
  const [kind, setKind] = useState<PipelineTransitionKind>('advance');
  const [target, setTarget] = useState('');
  const [operation, setOperation] = useState<{
    kind: PipelineTransitionKind;
    to: PipelineStatus;
  } | null>(null);
  const [result, setResult] = useState<string[]>([]);
  if (signal !== seenSignal) {
    setSeenSignal(signal);
    setKind(pipelineOptions(card, 'advance').includes('interviewing') ? 'advance' : 'correction');
    setTarget('interviewing');
  }
  const status = derivePipelineStatus(card);
  const kinds = KINDS.filter((k) => pipelineOptions(card, k).length > 0);
  const selectedKind = kinds.includes(kind) ? kind : (kinds[0] ?? 'advance');
  const options = pipelineOptions(card, selectedKind);
  const to = options.includes(target as PipelineStatus) ? target : '';
  const warnings = pipelineConsistency(status, { summary: card.interviewSummary });
  const issues = inspectPipelineState(card).issues;
  return (
    <section
      aria-label="Gestione candidatura"
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <h3 className="text-sm font-semibold">Gestisci la candidatura</h3>
      {issues.length > 0 ? (
        <p role="status" className="text-sm text-warning-soft-foreground">
          La fase «Chiusa» non ha un esito. Usa «Correggi stato» per allineare i dati.
        </p>
      ) : null}
      {warnings.length ? (
        <ul className="space-y-1 text-sm text-warning-soft-foreground">
          {warnings.map((w) => (
            <li key={w.code}>{WARNING_TEXT[w.code] ?? 'Controlla i dati della candidatura.'}</li>
          ))}
        </ul>
      ) : null}
      {kinds.length ? (
        <div className="grid items-end gap-3 sm:grid-cols-2">
          <Field id="pipeline-kind" label="Azione">
            <Select
              id="pipeline-kind"
              value={selectedKind}
              onChange={(e) => {
                setKind(e.target.value as PipelineTransitionKind);
                setTarget('');
              }}
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="pipeline-target" label="Stato di destinazione">
            <Select id="pipeline-target" value={to} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Scegli lo stato…</option>
              {options.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            className="sm:col-span-2 sm:justify-self-start"
            disabled={!to}
            onClick={() => setOperation({ kind: selectedKind, to: to as PipelineStatus })}
          >
            {selectedKind === 'advance' && to === 'applied'
              ? 'Segna come candidata'
              : KIND_LABELS[selectedKind]}
          </Button>
        </div>
      ) : null}
      {result.length > 0 ? (
        <div role="status" className="space-y-1 text-sm">
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
            setTarget('');
            setOperation(null);
          }}
        />
      ) : null}
    </section>
  );
}

function PipelineConfirmation({
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
