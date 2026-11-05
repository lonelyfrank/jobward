import type { ActivityEvent, Card, Column } from '@meet-roulette/schemas';
import {
  CONTRACT_TYPES,
  LIMITS,
  OUTCOMES,
  PRIORITIES,
  SALARY_BASES,
  SALARY_PERIODS,
  STAGES,
  WORK_MODES,
  type Priority,
} from '@meet-roulette/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { Textarea } from '@/components/ui/textarea';
import { useCardFields, usePutFieldValue } from '@/features/custom-fields/api';
import { CardFieldsSection } from '@/features/custom-fields/card-fields-section';
import { sameValue, valueFromDraft, type FieldDraft } from '@/features/custom-fields/values';
import { LabelPicker } from '@/features/labels/label-picker';
import { ApiRequestError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import {
  BASIS_LABELS,
  CONTRACT_LABELS,
  OUTCOME_LABELS,
  PERIOD_LABELS,
  PRIORITY_LABELS,
  STAGE_LABELS,
  WORK_MODE_LABELS,
} from '@/lib/labels';
import {
  useArchiveCard,
  useMoveCard,
  useRestoreCard,
  useUpdateCard,
  userMessage,
} from '@/features/kanban/mutations';
import {
  buildChanges,
  draftFromCard,
  serverFieldErrors,
  type CardDraft,
  type DraftErrors,
} from './card-form';
import { CardHistory } from './card-history';
import { DetailSection } from './detail-section';

const filled = (...values: string[]) => values.filter((v) => v.trim() !== '').length;
const plural = (n: number) => (n === 1 ? '1 campo compilato' : `${n} campi compilati`);

/**
 * Pannello di dettaglio (Card Detail 2.0): Panoramica, Opportunità, Candidatura, Cronologia.
 * Un solo salvataggio esplicito che invia SOLO i campi cambiati; la colonna e l'archiviazione
 * sono azioni immediate. Le sezioni vuote restano chiuse (informazioni progressive).
 */
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
  const [draft, setDraft] = useState<CardDraft>(() => draftFromCard(card));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Campi personalizzati: si tengono SOLO le bozze modificate, gli altri mostrano il valore salvato.
  const customFields = useCardFields(card.id);
  const putValue = usePutFieldValue(card.id);
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, FieldDraft>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof CardDraft>(key: K, value: CardDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };
  // Si inviano solo i campi cambiati: nessuna sovrascrittura di modifiche altrui sul resto.
  const built = buildChanges(draft, card);
  const cardDirty = Object.keys(built.changes).length > 0;

  // Valori personalizzati da scrivere: bozza diversa dal valore salvato (o non valida).
  const fieldPlan = (customFields.data ?? []).flatMap((entry) => {
    const edited = fieldDrafts[entry.field.id];
    if (edited === undefined) return [];
    const result = valueFromDraft(entry.field, edited);
    if (result.ok && sameValue(result.value, entry.value)) return [];
    return [{ entry, result }];
  });
  const dirty = cardDirty || fieldPlan.length > 0;

  const column = columns.find((c) => c.id === card.columnId);
  const suggestedStage =
    column?.category && column.category !== draft.stage ? column.category : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    // Prima si valida tutto: nessuna richiesta parte se qualcosa non è valido.
    const nextFieldErrors: Record<string, string> = {};
    for (const { entry, result } of fieldPlan) {
      if (!result.ok) nextFieldErrors[entry.field.id] = result.message;
    }
    if ((cardDirty && !built.input) || Object.keys(nextFieldErrors).length > 0) {
      setErrors(cardDirty ? built.errors : {});
      setFieldErrors(nextFieldErrors);
      return;
    }
    setErrors({});
    setFieldErrors({});
    setSaving(true);

    // La scheda e ogni campo sono richieste indipendenti: se una fallisce le altre restano salvate
    // e la bozza di ciò che non è andato a buon fine NON viene toccata.
    const writes: Promise<unknown>[] = [];
    if (built.input) writes.push(update.mutateAsync({ cardId: card.id, input: built.input }));
    const writtenFields = fieldPlan.flatMap(({ entry, result }) =>
      result.ok ? [{ entry, value: result.value }] : [],
    );
    for (const { entry, value } of writtenFields) {
      writes.push(putValue.mutateAsync({ fieldId: entry.field.id, value }));
    }
    const outcomes = await Promise.allSettled(writes);
    setSaving(false);

    let index = 0;
    let failedMessage: string | null = null;
    if (built.input) {
      const cardOutcome = outcomes[index++];
      if (cardOutcome?.status === 'rejected') {
        const e = cardOutcome.reason as unknown;
        if (e instanceof ApiRequestError && e.status === 400) {
          setErrors(serverFieldErrors(e.issues));
          failedMessage = 'Controlla i campi evidenziati.';
        } else {
          failedMessage = userMessage(e, 'Non siamo riusciti a salvare. Riprova.');
        }
      }
    }
    const savedIds: string[] = [];
    const failedFields: Record<string, string> = {};
    for (const { entry } of writtenFields) {
      const outcome = outcomes[index++];
      if (outcome?.status === 'fulfilled') savedIds.push(entry.field.id);
      else {
        const e = outcome?.reason as unknown;
        failedFields[entry.field.id] =
          e instanceof ApiRequestError && e.issues?.[0]
            ? e.issues[0].message
            : userMessage(e, 'Non siamo riusciti a salvare questo campo.');
      }
    }
    if (savedIds.length > 0) {
      setFieldDrafts((d) =>
        Object.fromEntries(Object.entries(d).filter(([id]) => !savedIds.includes(id))),
      );
    }
    setFieldErrors(failedFields);
    if (Object.keys(failedFields).length > 0) failedMessage ??= 'Controlla i campi evidenziati.';
    if (failedMessage) setFormError(failedMessage);
    else notify('success', 'Modifiche salvate.');
  };

  const revert = () => {
    setDraft(draftFromCard(card));
    setErrors({});
    setFieldDrafts({});
    setFieldErrors({});
    setFormError(null);
  };

  const changeColumn = (columnId: string) => {
    if (columnId === card.columnId) return;
    move.mutate({ cardId: card.id, columnId, afterCardId: lastCardIdOf(columnId) });
  };

  // Sezioni aperte all'inizio solo se contengono già qualcosa; gli errori le aprono comunque.
  const opportunityKeys = [
    'jobTitle',
    'location',
    'workMode',
    'contractType',
    'salaryMin',
    'salaryMax',
    'currency',
    'salaryPeriod',
    'salaryBasis',
    'source',
    'sourceUrl',
    'description',
  ] as const;
  const applicationKeys = ['publishedOn', 'appliedOn'] as const;
  const hasError = (keys: readonly (keyof CardDraft)[]) => keys.some((k) => errors[k]);
  const opportunityCount = filled(...opportunityKeys.map((k) => draft[k]));
  const applicationCount = filled(...applicationKeys.map((k) => draft[k]));
  const text = (
    key: keyof CardDraft,
    label: string,
    extra: {
      max?: number;
      hint?: string;
      placeholder?: string;
      type?: string;
      inputMode?: 'url' | 'numeric';
    } = {},
  ) => (
    <Field id={`card-${key}`} label={label} hint={extra.hint} error={errors[key]}>
      <Input
        id={`card-${key}`}
        type={extra.type ?? 'text'}
        {...(extra.inputMode ? { inputMode: extra.inputMode } : {})}
        value={draft[key]}
        maxLength={extra.max ?? LIMITS.nameMax}
        disabled={archived}
        autoComplete="off"
        placeholder={extra.placeholder}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={
          errors[key] ? `card-${key}-error` : extra.hint ? `card-${key}-hint` : undefined
        }
        onChange={(e) => set(key, e.target.value as never)}
      />
    </Field>
  );
  const choice = (
    key: keyof CardDraft,
    label: string,
    options: readonly { value: string; label: string }[],
    emptyLabel = 'Non indicato',
    hint?: string,
  ) => (
    <Field id={`card-${key}`} label={label} hint={hint} error={errors[key]}>
      <Select
        id={`card-${key}`}
        value={draft[key]}
        disabled={archived}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `card-${key}-error` : hint ? `card-${key}-hint` : undefined}
        onChange={(e) => set(key, e.target.value as never)}
      >
        <option value="">{emptyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
  const labelled = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
    values.map((value) => ({ value, label: labels[value] }));

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="space-y-4">
        {archived ? (
          <div
            role="status"
            className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground"
          >
            Questa scheda è archiviata e non compare nella bacheca. Ripristinala per modificarla.
          </div>
        ) : null}

        <DetailSection
          title="Panoramica"
          defaultOpen
          hasError={hasError(['title', 'company', 'priority', 'stage', 'outcome'])}
        >
          <Field id="card-title" label="Titolo" error={errors.title}>
            <Input
              id="card-title"
              value={draft.title}
              maxLength={LIMITS.titleMax}
              disabled={archived}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? 'card-title-error' : undefined}
              onChange={(e) => set('title', e.target.value)}
            />
          </Field>
          {text('company', 'Azienda o ente')}
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
                value={draft.priority}
                disabled={archived}
                onChange={(e) => set('priority', e.target.value as Priority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </Field>
            {choice('stage', 'Fase', labelled(STAGES, STAGE_LABELS), 'Non indicata')}
            {choice('outcome', 'Esito', labelled(OUTCOMES, OUTCOME_LABELS), 'Non indicato')}
          </div>
          <p className="text-xs text-muted-foreground">
            La colonna organizza la bacheca; fase ed esito descrivono la candidatura. Spostare la
            scheda non li cambia.
          </p>
          <LabelPicker
            cardId={card.id}
            boardId={boardId}
            labelIds={card.labelIds}
            disabled={archived}
          />
          {suggestedStage && !archived ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              La colonna “{column?.name}” corrisponde alla fase “{STAGE_LABELS[suggestedStage]}”.
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => set('stage', suggestedStage)}
              >
                Usa questa fase
              </Button>
            </p>
          ) : null}
        </DetailSection>

        <DetailSection
          title="Opportunità"
          summary={opportunityCount ? plural(opportunityCount) : 'Nessun dettaglio'}
          defaultOpen={opportunityCount > 0}
          hasError={hasError(opportunityKeys)}
        >
          {text('jobTitle', 'Posizione lavorativa', {
            hint: 'Il ruolo come scritto nell’annuncio.',
          })}
          <div className="grid gap-4 sm:grid-cols-2">
            {text('location', 'Sede')}
            {choice('workMode', 'Modalità di lavoro', labelled(WORK_MODES, WORK_MODE_LABELS))}
          </div>
          {choice('contractType', 'Tipo di contratto', labelled(CONTRACT_TYPES, CONTRACT_LABELS))}

          <fieldset className="space-y-3 rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-medium">Retribuzione</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {text('salaryMin', 'Minima', { max: 12, inputMode: 'numeric', placeholder: '1800' })}
              {text('salaryMax', 'Massima', { max: 12, inputMode: 'numeric', placeholder: '2200' })}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {text('currency', 'Valuta', { max: 3, placeholder: 'EUR' })}
              {choice(
                'salaryPeriod',
                'Periodicità',
                labelled(SALARY_PERIODS, PERIOD_LABELS),
                'Non indicata',
              )}
              {choice(
                'salaryBasis',
                'Lordo o netto',
                labelled(SALARY_BASES, BASIS_LABELS),
                'Non specificato',
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Importi interi, nella valuta indicata (nessuna conversione). Se non scegli lordo o
              netto, l’importo non sarà presentato come né l’uno né l’altro.
            </p>
          </fieldset>

          {text('source', 'Fonte', {
            hint: 'Dove hai trovato l’annuncio (sito, contatto, passaparola).',
          })}
          {text('sourceUrl', 'Indirizzo dell’annuncio', {
            max: LIMITS.urlMax,
            type: 'url',
            inputMode: 'url',
            placeholder: 'https://',
            hint: 'Link all’offerta originale (http o https).',
          })}
          {card.sourceUrl && draft.sourceUrl === (card.sourceUrl ?? '') ? (
            <p className="-mt-2 text-sm">
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
              value={draft.description}
              maxLength={LIMITS.descriptionMax}
              disabled={archived}
              className="min-h-28"
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>
        </DetailSection>

        <DetailSection
          title="Candidatura"
          summary={applicationCount ? plural(applicationCount) : 'Nessuna data'}
          defaultOpen={applicationCount > 0}
          hasError={hasError(applicationKeys)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {text('publishedOn', 'Data di pubblicazione', { type: 'date' })}
            {text('appliedOn', 'Data di candidatura', {
              type: 'date',
              hint: 'Quando hai inviato la candidatura.',
            })}
          </div>
        </DetailSection>

        <CardFieldsSection
          fields={customFields.data}
          drafts={fieldDrafts}
          errors={fieldErrors}
          loading={customFields.isPending}
          failed={customFields.isError}
          disabled={archived}
          onRetry={() => void customFields.refetch()}
          onChange={(fieldId, value) => {
            setFieldDrafts((d) => ({ ...d, [fieldId]: value }));
            setFieldErrors((e) => {
              if (!e[fieldId]) return e;
              const { [fieldId]: _removed, ...rest } = e;
              return rest;
            });
          }}
        />

        {formError ? (
          <p
            role="alert"
            className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
          >
            {formError}
          </p>
        ) : null}

        <DetailSection title="Cronologia" defaultOpen summary={`${history.length} eventi`}>
          <CardHistory events={history} timeZone={timeZone} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <dt>Creata</dt>
            <dd>{formatDateTime(card.createdAt, timeZone)}</dd>
            <dt>Aggiornata</dt>
            <dd>{formatDateTime(card.updatedAt, timeZone)}</dd>
          </dl>
        </DetailSection>
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
              type="button"
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
            <span role="status" className="text-xs text-muted-foreground">
              {saving ? 'Salvataggio…' : dirty ? 'Modifiche non salvate' : ''}
            </span>
            <Button type="button" variant="secondary" disabled={!dirty || saving} onClick={revert}>
              Annulla modifiche
            </Button>
            <Button type="submit" disabled={!dirty || saving}>
              {saving ? 'Salvataggio…' : 'Salva'}
            </Button>
          </>
        )}
      </DialogFooter>
    </form>
  );
}
