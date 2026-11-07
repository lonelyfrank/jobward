import { createTaskInput, updateTaskInput, type Task, type TaskAsOf } from '@jobward/schemas';
import {
  addDays,
  LIMITS,
  PRIORITIES,
  TASK_KINDS,
  type Priority,
  type TaskKind,
} from '@jobward/shared';
import { useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import { useBlocker } from 'react-router';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { Textarea } from '@/components/ui/textarea';
import { useCreationOperation } from '@/features/cards/creation-operation';
import { DirtyGuardContext, useDirtyReporter } from '@/features/cards/dirty-guard';
import { workflowError } from '@/features/cards/workflow-feedback';
import { ApiRequestError } from '@/lib/api';
import { PRIORITY_LABELS } from '@/lib/labels';
import { useTaskActions, useTaskFetcher } from './api';
import { CardPicker, type PickedCard } from './card-picker';
import { TASK_KIND_DESCRIPTIONS, TASK_KIND_LABELS } from './presentation';

export interface TaskDraft {
  title?: string;
  kind?: TaskKind;
  dueOn?: string | null;
  card?: PickedCard | null;
  /** Aperta da una candidatura: il collegamento non si cambia. */
  fixedCard?: boolean;
}

const cardOf = (task: Task): PickedCard | null =>
  task.card ? { id: task.card.id, title: task.card.title, company: task.card.company } : null;

/**
 * Creazione e modifica di un'attività (un solo componente, nessuna logica duplicata).
 *  - creazione: ID generato all'apertura, payload immutabile alla prima richiesta, retry con lo stesso ID;
 *  - modifica: invia solo i campi cambiati con `expectedUpdatedAt` (compare-and-swap);
 *  - bozze protette: conferma su Esc/chiudi, `beforeunload` e navigazione (o registro della modale
 *    della candidatura, se aperta da lì). Montare SOLO quando serve: lo stato nasce a ogni apertura.
 */
export function TaskDialog({
  task,
  draft,
  asOf,
  onClose,
}: {
  task: Task | null;
  draft?: TaskDraft;
  asOf: TaskAsOf;
  onClose: () => void;
}) {
  const notify = useNotify();
  const actions = useTaskActions();
  const fetchTask = useTaskFetcher();
  const operation = useCreationOperation<ReturnType<typeof createTaskInput.parse>>();
  const nested = useContext(DirtyGuardContext) !== null;

  const [base, setBase] = useState<Task | null>(task);
  const initial = {
    title: base?.title ?? draft?.title ?? '',
    description: base?.description ?? '',
    dueOn: base ? (base.dueOn ?? '') : (draft?.dueOn ?? ''),
    kind: base?.kind ?? draft?.kind ?? 'general',
    priority: base?.priority ?? 'none',
    card: base ? cardOf(base) : (draft?.card ?? null),
  };
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [dueOn, setDueOn] = useState(initial.dueOn);
  const [kind, setKind] = useState<TaskKind>(initial.kind);
  const [priority, setPriority] = useState<Priority>(initial.priority);
  const [card, setCard] = useState<PickedCard | null>(initial.card);
  const [more, setMore] = useState(initial.kind !== 'general' || initial.priority !== 'none');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [pending, setPending] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const editing = base !== null;
  const readOnly = editing && (base.status !== 'open' || base.card?.archived === true);
  const changed =
    title !== initial.title ||
    description !== initial.description ||
    dueOn !== initial.dueOn ||
    kind !== initial.kind ||
    priority !== initial.priority ||
    (card?.id ?? null) !== (initial.card?.id ?? null);
  const dirty = (changed && !readOnly) || operation.locked || pending;

  useDirtyReporter('task-dialog', dirty);
  const blocker = useBlocker(() => dirty && !nested);
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => titleRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  const requestClose = () => (dirty ? setDiscard(true) : onClose());
  const quick = (days: number) => setDueOn(addDays(asOf.today, days));

  const submit = async (event: FormEvent) => {
    // Il dialogo è in un portale: senza questo l'evento risalirebbe al modulo della candidatura.
    event.preventDefault();
    event.stopPropagation();
    if (readOnly) return;
    setError(null);
    setErrors({});
    const fields = {
      title,
      description: description.trim() ? description : null,
      kind,
      priority,
      dueOn: dueOn || null,
      cardId: card?.id ?? null,
    };
    setPending(true);
    try {
      if (!editing) {
        const parsed = createTaskInput.safeParse({ id: operation.id, ...fields });
        if (!parsed.success) return fail(parsed.error.issues);
        const response = await actions.create.mutateAsync(operation.capture(parsed.data));
        notify(
          'success',
          response.task.kind === 'follow_up' ? 'Follow-up creato.' : 'Attività creata.',
        );
      } else {
        const diff: Record<string, unknown> = {};
        if (fields.title !== initial.title) diff['title'] = fields.title;
        if ((fields.description ?? '') !== initial.description)
          diff['description'] = fields.description;
        if (fields.dueOn !== (initial.dueOn || null)) diff['dueOn'] = fields.dueOn;
        if (fields.kind !== initial.kind) diff['kind'] = fields.kind;
        if (fields.priority !== initial.priority) diff['priority'] = fields.priority;
        if (fields.cardId !== (initial.card?.id ?? null)) diff['cardId'] = fields.cardId;
        const parsed = updateTaskInput.safeParse({ expectedUpdatedAt: base.updatedAt, ...diff });
        if (!parsed.success) return fail(parsed.error.issues);
        await actions.update.mutateAsync({
          id: base.id,
          input: parsed.data,
          previousCardId: base.cardId,
        });
        notify('success', 'Attività aggiornata.');
      }
      setPending(false);
      onClose();
    } catch (e) {
      if (!editing) operation.failed(e);
      setStale(e instanceof ApiRequestError && e.status === 409 && editing);
      setError(workflowError(e));
    } finally {
      setPending(false);
    }
  };
  function fail(issues: { path: PropertyKey[]; message: string }[]) {
    const map: Record<string, string> = {};
    for (const i of issues) map[String(i.path[0] ?? 'form')] ??= i.message;
    setErrors(map);
    if (map['title'] === undefined && Object.keys(map).length === 0)
      setError('Controlla i dati inseriti.');
    return undefined;
  }
  const refresh = async () => {
    if (!base) return;
    try {
      const latest = await fetchTask(base.id);
      setBase({ ...base, updatedAt: latest.task.updatedAt, status: latest.task.status });
      setStale(false);
      setError(
        latest.task.status === 'open'
          ? 'Dati aggiornati: le tue modifiche sono ancora qui. Salva di nuovo per applicarle.'
          : 'L’attività non è più da fare: riaprila per modificarla.',
      );
    } catch (e) {
      setError(workflowError(e));
    }
  };

  const disabled = pending || readOnly || (!editing && operation.locked);
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
        title={editing ? 'Modifica attività' : 'Nuova attività'}
        description={
          readOnly
            ? 'Questa attività non si può modificare.'
            : 'Cosa devi fare, entro quando e per quale candidatura.'
        }
      >
        <form
          noValidate
          aria-label={editing ? 'Modifica attività' : 'Nuova attività'}
          onSubmit={(e) => void submit(e)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <DialogBody className="space-y-4">
            {readOnly ? (
              <p
                role="status"
                className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground"
              >
                {base?.card?.archived
                  ? 'La candidatura è archiviata: ripristinala per modificare questa attività.'
                  : 'Le attività completate o annullate non si modificano: riaprila dall’elenco.'}
              </p>
            ) : null}
            <Field id="task-title" label="Titolo" error={errors['title']}>
              <Input
                ref={titleRef}
                id="task-title"
                value={title}
                maxLength={LIMITS.titleMax}
                disabled={disabled}
                aria-required="true"
                aria-invalid={errors['title'] ? true : undefined}
                aria-describedby={errors['title'] ? 'task-title-error' : undefined}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>

            <Field
              id="task-due"
              label="Scadenza"
              error={errors['dueOn']}
              hint="Un giorno, senza orario."
            >
              <Input
                id="task-due"
                type="date"
                value={dueOn}
                disabled={disabled}
                aria-invalid={errors['dueOn'] ? true : undefined}
                onChange={(e) => setDueOn(e.target.value)}
              />
            </Field>
            {!disabled ? (
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Scorciatoie per la scadenza"
              >
                <Button variant="secondary" size="sm" onClick={() => quick(0)}>
                  Oggi
                </Button>
                <Button variant="secondary" size="sm" onClick={() => quick(1)}>
                  Domani
                </Button>
                <Button variant="secondary" size="sm" onClick={() => quick(7)}>
                  Fra una settimana
                </Button>
                <Button variant="ghost" size="sm" disabled={!dueOn} onClick={() => setDueOn('')}>
                  Rimuovi scadenza
                </Button>
              </div>
            ) : null}

            <Field id="task-card-search" label="Candidatura collegata (facoltativa)">
              <CardPicker
                value={card}
                onChange={setCard}
                disabled={disabled}
                fixed={draft?.fixedCard === true && !editing}
              />
            </Field>

            <Field
              id="task-description"
              label="Descrizione (facoltativa)"
              hint={`${description.length.toLocaleString('it-IT')} / ${LIMITS.taskDescriptionMax.toLocaleString('it-IT')} caratteri`}
              error={errors['description']}
            >
              <Textarea
                id="task-description"
                value={description}
                maxLength={LIMITS.taskDescriptionMax}
                disabled={disabled}
                className="min-h-24"
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>

            <div>
              <button
                type="button"
                aria-expanded={more}
                aria-controls="task-more"
                className="min-h-11 text-sm font-medium text-primary hover:underline"
                onClick={() => setMore((v) => !v)}
              >
                {more ? 'Nascondi altre opzioni' : 'Altre opzioni (tipo e priorità)'}
              </button>
              <div id="task-more" hidden={!more} className="mt-2 space-y-4">
                <fieldset disabled={disabled} className="space-y-1">
                  <legend className="mb-1 text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                    Tipo
                  </legend>
                  {TASK_KINDS.map((k) => (
                    <label key={k} className="flex min-h-11 items-start gap-2 py-1.5 text-sm">
                      <input
                        type="radio"
                        name="task-kind"
                        value={k}
                        className="mt-1"
                        checked={kind === k}
                        onChange={() => setKind(k)}
                      />
                      <span>
                        <span className="font-medium">{TASK_KIND_LABELS[k]}</span>
                        <span className="block text-muted-foreground">
                          {TASK_KIND_DESCRIPTIONS[k]}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <Field id="task-priority" label="Priorità">
                  <Select
                    id="task-priority"
                    value={priority}
                    disabled={disabled}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>

            {error ? (
              <div role="alert" className="space-y-2 text-sm text-danger">
                <p>{error}</p>
                {stale ? (
                  <Button variant="secondary" onClick={() => void refresh()}>
                    Ricarica i dati più recenti
                  </Button>
                ) : null}
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" disabled={pending} onClick={requestClose}>
              {readOnly ? 'Chiudi' : 'Annulla'}
            </Button>
            {!readOnly ? (
              <Button
                type="submit"
                disabled={pending || (editing ? !changed : false) || (!editing && !title.trim())}
              >
                {pending
                  ? 'Salvataggio…'
                  : !editing && operation.locked
                    ? 'Riprova la stessa richiesta'
                    : editing
                      ? 'Salva modifiche'
                      : 'Crea attività'}
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </Dialog>
      <ConfirmDialog
        open={discard || blocker.state === 'blocked'}
        onOpenChange={(open) => {
          setDiscard(open);
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title="Hai modifiche non salvate"
        description={
          <p>
            La bozza andrà persa.
            {operation.locked
              ? ' Se la risposta non è arrivata, l’attività potrebbe essere già stata creata: controlla l’elenco prima di crearne un’altra.'
              : ''}
          </p>
        }
        confirmLabel="Esci senza salvare"
        onConfirm={() => {
          setDiscard(false);
          if (blocker.state === 'blocked') blocker.proceed();
          else onClose();
        }}
      />
    </>
  );
}
