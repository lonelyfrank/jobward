import { updateCardInput, type Card, type Column } from '@meet-roulette/schemas';
import { LIMITS, PRIORITIES, type Priority } from '@meet-roulette/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/lib/format';
import { PRIORITY_LABELS } from '@/lib/labels';
import {
  useArchiveCard,
  useMoveCard,
  useRestoreCard,
  useUpdateCard,
  userMessage,
} from '@/features/kanban/mutations';
import type { ActivityEvent } from '@meet-roulette/schemas';
import { CardHistory } from './card-history';

type FieldErrors = Partial<Record<'title' | 'description' | 'company' | 'sourceUrl', string>>;

/** Modulo di modifica di una scheda + colonna, archiviazione e cronologia. */
export function CardDetailForm({
  boardId,
  card,
  history,
  columns,
  lastCardIdOf,
  timeZone,
  onArchived,
}: {
  boardId: string;
  card: Card;
  history: ActivityEvent[];
  columns: Column[];
  /** Ultima scheda di una colonna: serve a spostare "in fondo" dal selettore Colonna. */
  lastCardIdOf: (columnId: string) => string | null;
  timeZone: string;
  onArchived: () => void;
}) {
  const notify = useNotify();
  const update = useUpdateCard(boardId);
  const move = useMoveCard(boardId);
  const archive = useArchiveCard(boardId);
  const restore = useRestoreCard(boardId);

  const archived = card.archivedAt !== null;
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? '');
  const [priority, setPriority] = useState<Priority>(card.priority);
  const [company, setCompany] = useState(card.company ?? '');
  const [sourceUrl, setSourceUrl] = useState(card.sourceUrl ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const nullable = (value: string) => (value.trim() === '' ? null : value.trim());
  const draft = {
    title: title.trim(),
    description: nullable(description),
    priority,
    company: nullable(company),
    sourceUrl: nullable(sourceUrl),
  };
  // Si inviano solo i campi cambiati: nessuna sovrascrittura di modifiche altrui sul resto.
  const changes = {
    ...(draft.title !== card.title ? { title: draft.title } : {}),
    ...(draft.description !== card.description ? { description: draft.description } : {}),
    ...(draft.priority !== card.priority ? { priority: draft.priority } : {}),
    ...(draft.company !== card.company ? { company: draft.company } : {}),
    ...(draft.sourceUrl !== card.sourceUrl ? { sourceUrl: draft.sourceUrl } : {}),
  };
  const dirty = Object.keys(changes).length > 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const parsed = updateCardInput.safeParse(changes);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]) as keyof FieldErrors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    update.mutate(
      { cardId: card.id, input: parsed.data },
      {
        onSuccess: () => notify('success', 'Modifiche salvate.'),
        onError: (e) => setFormError(userMessage(e, 'Non siamo riusciti a salvare. Riprova.')),
      },
    );
  };

  const changeColumn = (columnId: string) => {
    if (columnId === card.columnId) return;
    move.mutate({ cardId: card.id, columnId, afterCardId: lastCardIdOf(columnId) });
  };

  return (
    <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="space-y-5">
        {archived ? (
          <div
            role="status"
            className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground"
          >
            Questa scheda è archiviata e non compare nella bacheca. Ripristinala per modificarla.
          </div>
        ) : null}

        <Field id="card-title" label="Titolo" error={errors.title}>
          <Input
            id="card-title"
            value={title}
            maxLength={LIMITS.titleMax}
            disabled={archived}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? 'card-title-error' : undefined}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="card-column" label="Colonna">
            <Select
              id="card-column"
              value={card.columnId}
              disabled={archived || move.isPending}
              onChange={(e) => changeColumn(e.target.value)}
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="card-priority" label="Priorità">
            <Select
              id="card-priority"
              value={priority}
              disabled={archived}
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

        <Field id="card-company" label="Azienda" error={errors.company}>
          <Input
            id="card-company"
            value={company}
            maxLength={LIMITS.nameMax}
            disabled={archived}
            autoComplete="off"
            onChange={(e) => setCompany(e.target.value)}
          />
        </Field>

        <Field
          id="card-url"
          label="Indirizzo dell’annuncio"
          hint="Link all’offerta originale (http o https)."
          error={errors.sourceUrl}
        >
          <Input
            id="card-url"
            type="url"
            inputMode="url"
            value={sourceUrl}
            maxLength={LIMITS.urlMax}
            disabled={archived}
            placeholder="https://"
            autoComplete="off"
            aria-invalid={errors.sourceUrl ? true : undefined}
            aria-describedby={errors.sourceUrl ? 'card-url-error' : 'card-url-hint'}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
        </Field>
        {card.sourceUrl && !dirty ? (
          <p className="-mt-3 text-sm">
            <a
              href={card.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2"
            >
              Apri l’annuncio<span className="sr-only"> (si apre in una nuova scheda)</span>
            </a>
          </p>
        ) : null}

        <Field id="card-description" label="Note" error={errors.description}>
          <Textarea
            id="card-description"
            value={description}
            maxLength={LIMITS.descriptionMax}
            disabled={archived}
            className="min-h-32"
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        {formError ? (
          <p
            role="alert"
            className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
          >
            {formError}
          </p>
        ) : null}

        <section aria-labelledby="card-history-title" className="border-t border-border pt-4">
          <h3 id="card-history-title" className="mb-3 text-sm font-semibold">
            Cronologia
          </h3>
          <CardHistory events={history} timeZone={timeZone} />
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <dt>Creata</dt>
            <dd>{formatDateTime(card.createdAt, timeZone)}</dd>
            <dt>Aggiornata</dt>
            <dd>{formatDateTime(card.updatedAt, timeZone)}</dd>
          </dl>
        </section>
      </DialogBody>

      <DialogFooter>
        {archived ? (
          <Button
            onClick={() =>
              restore.mutate(card.id, {
                onSuccess: () => notify('success', 'Scheda ripristinata.'),
                onError: (e) =>
                  setFormError(userMessage(e, 'Non siamo riusciti a ripristinare la scheda.')),
              })
            }
            disabled={restore.isPending}
          >
            Ripristina scheda
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              className="mr-auto"
              disabled={archive.isPending}
              onClick={() =>
                archive.mutate(card.id, {
                  onSuccess: () => {
                    notify('success', `Scheda “${card.title}” archiviata.`, {
                      label: 'Annulla',
                      onClick: () => restore.mutate(card.id),
                    });
                    onArchived();
                  },
                  onError: (e) =>
                    setFormError(userMessage(e, 'Non siamo riusciti ad archiviare la scheda.')),
                })
              }
            >
              Archivia
            </Button>
            <Button
              variant="secondary"
              disabled={!dirty || update.isPending}
              onClick={() => {
                setTitle(card.title);
                setDescription(card.description ?? '');
                setPriority(card.priority);
                setCompany(card.company ?? '');
                setSourceUrl(card.sourceUrl ?? '');
                setErrors({});
                setFormError(null);
              }}
            >
              Annulla modifiche
            </Button>
            <Button type="submit" disabled={!dirty || update.isPending}>
              {update.isPending ? 'Salvataggio…' : 'Salva'}
            </Button>
          </>
        )}
      </DialogFooter>
    </form>
  );
}
