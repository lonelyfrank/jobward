import type { Application, Card } from '@jobward/schemas';
import { derivePipelineStatus, isClosedPipelineStatus, localDate } from '@jobward/shared';
import { FileClock, Plus, Send } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { STATUS_LABELS } from '@/features/pipeline/presentation';
import { useWorkspace } from '@/features/workspace/context';
import { ApiRequestError } from '@/lib/api';
import { formatCalendarDate } from '@/lib/format';
import { useApplications, useCreateApplication, useUpdateApplication } from './api';

const message = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : 'Operazione non riuscita: riprova.';

/**
 * Candidature dell'opportunità (Opportunity 1:N Application). La corrente determina lo stato mostrato
 * ovunque; le precedenti restano come storico. «Candidati» crea la prima, «Nuova candidatura» una
 * ricandidatura quando la corrente è chiusa. Lo stato si cambia con la pipeline, non qui.
 */
export function ApplicationsPanel({ card }: { card: Card }) {
  const { workspace } = useWorkspace();
  const notify = useNotify();
  const applications = useApplications(card.id);
  const create = useCreateApplication(card);
  const archived = card.archivedAt !== null;
  const list = applications.data ?? [];
  const current = list.find((a) => a.current) ?? null;
  const currentClosed =
    current !== null &&
    isClosedPipelineStatus(
      derivePipelineStatus({ stage: current.stage, outcome: current.outcome, archivedAt: null }),
    );
  const canCreate = !archived && (current === null || currentClosed);

  const apply = async (stage: 'applied' | 'preparing') => {
    try {
      await create.mutateAsync({
        id: crypto.randomUUID(),
        stage,
        ...(stage === 'applied' ? { appliedOn: localDate(Date.now(), workspace.timezone) } : {}),
      });
      notify(
        'success',
        stage === 'applied'
          ? 'Candidatura registrata come inviata oggi.'
          : 'Candidatura in preparazione creata.',
      );
    } catch (error) {
      notify('error', message(error));
    }
  };

  return (
    <section aria-labelledby={`applications-${card.id}`} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`applications-${card.id}`} className="text-sm font-semibold">
          Candidature{list.length > 0 ? ` (${list.length})` : ''}
        </h3>
        {canCreate ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void apply('applied')} disabled={create.isPending}>
              <Send aria-hidden className="size-4" />
              {current ? 'Nuova candidatura' : 'Candidati'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void apply('preparing')}
              disabled={create.isPending}
            >
              <Plus aria-hidden className="size-4" />
              In preparazione
            </Button>
          </div>
        ) : null}
      </div>

      {applications.isPending ? (
        <p className="text-sm text-muted-foreground">Caricamento delle candidature…</p>
      ) : applications.isError ? (
        <p className="text-sm text-danger" role="alert">
          Impossibile caricare le candidature.
        </p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Opportunità salvata: non hai ancora inviato una candidatura. Quando ti candidi, i dati
          dell’annuncio vengono fotografati e restano consultabili anche se cambi la scheda.
        </p>
      ) : (
        <ol className="space-y-2">
          {list.map((application) => (
            <ApplicationItem
              key={application.id}
              card={card}
              application={application}
              disabled={archived}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function ApplicationItem({
  card,
  application,
  disabled,
}: {
  card: Card;
  application: Application;
  disabled: boolean;
}) {
  const notify = useNotify();
  const update = useUpdateApplication(card);
  const [editing, setEditing] = useState(false);
  const [appliedOn, setAppliedOn] = useState(application.appliedOn ?? '');
  const [channel, setChannel] = useState(application.channel ?? '');
  const status = derivePipelineStatus({
    stage: application.stage,
    outcome: application.outcome,
    archivedAt: null,
  });
  const idBase = `application-${application.id}`;
  // Invio salva QUESTA candidatura (e non il modulo della scheda che contiene il pannello).
  const saveOnEnter = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void save();
    }
  };

  const save = async () => {
    try {
      await update.mutateAsync({
        id: application.id,
        input: { appliedOn: appliedOn === '' ? null : appliedOn, channel },
      });
      notify('success', 'Dati della candidatura aggiornati.');
      setEditing(false);
    } catch (error) {
      notify('error', message(error));
    }
  };

  return (
    <li className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Candidatura n. {application.sequence}</span>
        <Badge tone={application.current ? 'primary' : 'neutral'}>
          {application.current ? 'Corrente' : 'Precedente'}
        </Badge>
        <Badge tone={isClosedPipelineStatus(status) ? 'neutral' : 'info'}>
          {STATUS_LABELS[status]}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {application.appliedOn
          ? `Inviata il ${formatCalendarDate(application.appliedOn)}`
          : 'Data d’invio non indicata'}
        {application.channel ? ` · ${application.channel}` : ''}
      </p>
      {application.snapshot ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <FileClock aria-hidden className="size-3.5" />
          Dati all’invio: {application.snapshot.title}
          {application.snapshot.company ? ` · ${application.snapshot.company}` : ''}
          {application.snapshot.location ? ` · ${application.snapshot.location}` : ''}
        </p>
      ) : null}

      {editing ? (
        // Niente <form>: il pannello vive dentro il modulo della scheda (form annidati non validi).
        <div
          role="group"
          aria-label={`Dati d’invio della candidatura n. ${application.sequence}`}
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <Field id={`${idBase}-applied`} label="Data d’invio">
            <Input
              id={`${idBase}-applied`}
              type="date"
              value={appliedOn}
              onKeyDown={saveOnEnter}
              onChange={(e) => setAppliedOn(e.target.value)}
            />
          </Field>
          <Field id={`${idBase}-channel`} label="Canale">
            <Input
              id={`${idBase}-channel`}
              value={channel}
              maxLength={120}
              placeholder="Sito aziendale, portale, email…"
              onKeyDown={saveOnEnter}
              onChange={(e) => setChannel(e.target.value)}
            />
          </Field>
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={() => void save()} disabled={update.isPending}>
              Salva
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Annulla
            </Button>
          </div>
        </div>
      ) : !disabled ? (
        <Button
          size="sm"
          variant="ghost"
          className="mt-2"
          onClick={() => setEditing(true)}
          aria-label={`Modifica data e canale della candidatura n. ${application.sequence}`}
        >
          Modifica data e canale
        </Button>
      ) : null}
    </li>
  );
}
