import type { Card, Column } from '@jobward/schemas';
import {
  CONTRACT_TYPES,
  LIMITS,
  PRIORITIES,
  SALARY_BASES,
  SALARY_PERIODS,
  WORK_MODES,
  type Priority,
} from '@jobward/shared';
import { ExternalLink, Plus } from 'lucide-react';
import { lazy, Suspense, useContext, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DialogBody, DialogCloseButton, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { Textarea } from '@/components/ui/textarea';
import { useCardFields, usePutFieldValue } from '@/features/custom-fields/api';
import { CardFieldsSection } from '@/features/custom-fields/card-fields-section';
import { sameValue, valueFromDraft, type FieldDraft } from '@/features/custom-fields/values';
import { LabelPicker } from '@/features/labels/label-picker';
import { ApiRequestError } from '@/lib/api';
import {
  BASIS_LABELS,
  CONTRACT_LABELS,
  OUTCOME_LABELS,
  PERIOD_LABELS,
  PRIORITY_LABELS,
  PRIORITY_TONE,
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
import { InterviewsTab } from '@/features/interviews/interviews-tab';
import { PipelinePanel } from '@/features/pipeline/pipeline-panel';
import { PipelineStatusBadge } from '@/features/pipeline/status-badge';
import { DirtyGuardContext, useDirtyReporter } from './dirty-guard';
import { DetailSection } from './detail-section';
import { CardTasksSection } from '@/features/tasks/card-tasks-section';
import { SmartSummary } from './smart-summary';
import { CARD_TABS, type CardTab } from './workspace-tabs';

const NotesTab = lazy(() =>
  import('@/features/notes/notes-tab').then((m) => ({ default: m.NotesTab })),
);
const DocumentsTab = lazy(() =>
  import('@/features/documents/documents-tab').then((m) => ({ default: m.DocumentsTab })),
);
const TimelineTab = lazy(() =>
  import('@/features/timeline/timeline-tab').then((m) => ({ default: m.TimelineTab })),
);

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
  columns,
  lastCardIdOf,
  timeZone,
  tab,
  onTabChange,
  onArchived,
}: {
  boardId: string;
  card: Card;
  columns: Column[];
  /** Ultima scheda di una colonna: serve a spostare "in fondo" dal selettore Colonna. */
  lastCardIdOf: (columnId: string) => string | null;
  timeZone: string;
  tab: CardTab;
  onTabChange: (tab: CardTab) => void;
  onArchived: () => void;
}) {
  const notify = useNotify();
  const dirtyRegistry = useContext(DirtyGuardContext);
  const [pipelineSignal, setPipelineSignal] = useState(0);
  const [visited, setVisited] = useState<Set<CardTab>>(() => new Set([tab]));
  if (!visited.has(tab)) setVisited(new Set([...visited, tab]));
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
  const [createSignal, setCreateSignal] = useState(0);

  // Se la scheda cambia da fuori (aggiornamento rapido della fase, altro dispositivo) i campi che
  // l'utente NON ha toccato seguono il valore salvato; quelli in modifica restano com'erano.
  const snapshot = draftFromCard(card);
  const [base, setBase] = useState<CardDraft>(snapshot);
  if (JSON.stringify(base) !== JSON.stringify(snapshot)) {
    setDraft((d) => {
      const next = { ...d };
      for (const key of Object.keys(snapshot) as (keyof CardDraft)[]) {
        if (d[key] === base[key]) (next as Record<string, unknown>)[key] = snapshot[key];
      }
      return next;
    });
    setBase(snapshot);
  }

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
  useDirtyReporter('card-form', dirty);
  const formTab = tab === 'overview' || tab === 'details';

  const managePipeline = () => {
    onTabChange('overview');
    setPipelineSignal((n) => n + 1);
  };
  const requestInterview = () => {
    onTabChange('interviews');
    setCreateSignal((n) => n + 1);
  };

  const column = columns.find((c) => c.id === card.columnId);

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
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value as CardTab)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <header className="flex shrink-0 items-start gap-3 px-4 pt-4 pb-3 md:px-6 md:pt-5">
        <div className="min-w-0 flex-1">
          {/* Il nome accessibile della finestra è il titolo sr-only del Dialog: qui solo presentazione. */}
          <p
            aria-hidden="true"
            className="text-[22px] leading-tight font-extrabold tracking-tight break-words"
          >
            {card.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {[card.company, card.jobTitle].filter(Boolean).join(' · ') || 'Azienda non indicata'}
          </p>
          <ul
            aria-label="Stato della candidatura"
            className="mt-2 flex flex-wrap items-center gap-1.5"
          >
            <li>
              <PipelineStatusBadge state={card} />
            </li>
            {card.outcome ? (
              <li>
                <Badge>{OUTCOME_LABELS[card.outcome]}</Badge>
              </li>
            ) : null}
            {card.priority !== 'none' ? (
              <li>
                <Badge tone={PRIORITY_TONE[card.priority]}>
                  Priorità {PRIORITY_LABELS[card.priority].toLowerCase()}
                </Badge>
              </li>
            ) : null}
            {column ? (
              <li>
                <Badge>Colonna: {column.name}</Badge>
              </li>
            ) : null}
            {archived ? (
              <li>
                <Badge tone="warning">Archiviata</Badge>
              </li>
            ) : null}
          </ul>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {card.sourceUrl ? (
            <Button asChild variant="ghost" size="sm" className="max-md:hidden">
              <a href={card.sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                Apri annuncio<span className="sr-only"> (si apre in una nuova scheda)</span>
              </a>
            </Button>
          ) : null}
          {!archived ? (
            <Button
              variant="secondary"
              size="sm"
              className="max-sm:min-w-11"
              onClick={requestInterview}
            >
              <Plus aria-hidden="true" />
              <span className="max-sm:sr-only">Colloquio</span>
            </Button>
          ) : null}
          <DialogCloseButton />
        </div>
      </header>

      <TabsList variant="pill" aria-label="Sezioni della candidatura">
        {CARD_TABS.map((entry) => (
          <TabsTrigger key={entry.id} value={entry.id}>
            {entry.label}
            {entry.id === 'interviews' && card.interviewSummary.total > 0 ? (
              <span className="rounded-full bg-surface-muted px-1.5 text-xs">
                <span className="sr-only"> (</span>
                {card.interviewSummary.total}
                <span className="sr-only">)</span>
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>

      <DialogBody className="space-y-4 pt-5">
        {archived ? (
          <div
            role="status"
            className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground"
          >
            Questa scheda è archiviata e non compare nella bacheca. Ripristinala per modificarla.
          </div>
        ) : null}

        <form id="card-form" noValidate onSubmit={(e) => void submit(e)} className="space-y-4">
          <TabsContent value="overview" className="space-y-4">
            <SmartSummary
              card={card}
              timeZone={timeZone}
              disabled={archived}
              onOpenInterviews={() => onTabChange('interviews')}
              onAddInterview={requestInterview}
            />
            <CardTasksSection card={card} archived={archived} />
            <PipelinePanel card={card} signal={pipelineSignal} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => onTabChange('notes')}>
                Apri note
              </Button>
              <Button variant="secondary" onClick={() => onTabChange('documents')}>
                Apri documenti
              </Button>
              <Button variant="secondary" onClick={() => onTabChange('timeline')}>
                Apri timeline
              </Button>
            </div>
            <div className="space-y-4 rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold">Dati principali</h3>
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
                <Field id="card-stage" label="Fase">
                  <Input
                    id="card-stage"
                    readOnly
                    value={card.stage ? STAGE_LABELS[card.stage] : 'Non indicata'}
                  />
                </Field>
                <Field id="card-outcome" label="Esito">
                  <Input
                    id="card-outcome"
                    readOnly
                    value={card.outcome ? OUTCOME_LABELS[card.outcome] : 'Non indicato'}
                  />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">
                La colonna organizza la bacheca; fase ed esito descrivono la candidatura. Spostare
                la scheda non li cambia.
              </p>
              <LabelPicker
                cardId={card.id}
                boardId={boardId}
                labelIds={card.labelIds}
                disabled={archived}
              />
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
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
              {choice(
                'contractType',
                'Tipo di contratto',
                labelled(CONTRACT_TYPES, CONTRACT_LABELS),
              )}

              <fieldset className="space-y-3 rounded-md border border-border p-3">
                <legend className="px-1 text-sm font-medium">Retribuzione</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  {text('salaryMin', 'Minima', {
                    max: 12,
                    inputMode: 'numeric',
                    placeholder: '1800',
                  })}
                  {text('salaryMax', 'Massima', {
                    max: 12,
                    inputMode: 'numeric',
                    placeholder: '2200',
                  })}
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
          </TabsContent>
        </form>

        <TabsContent value="interviews">
          <InterviewsTab
            card={card}
            archived={archived}
            createSignal={createSignal}
            stagePending={false}
            onSetStage={managePipeline}
          />
        </TabsContent>

        <Suspense fallback={<p role="status">Caricamento della sezione…</p>}>
          <TabsContent value="timeline">
            {visited.has('timeline') ? (
              <TimelineTab cardId={card.id} timeZone={timeZone} active={tab === 'timeline'} />
            ) : null}
          </TabsContent>
          <TabsContent value="notes">
            {visited.has('notes') ? (
              <NotesTab card={card} timeZone={timeZone} active={tab === 'notes'} />
            ) : null}
          </TabsContent>
          <TabsContent value="documents">
            {visited.has('documents') ? (
              <DocumentsTab card={card} active={tab === 'documents'} />
            ) : null}
          </TabsContent>
        </Suspense>

        {formError ? (
          <p
            role="alert"
            className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
          >
            {formError}
          </p>
        ) : null}
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
              onClick={() => {
                if (dirtyRegistry?.current.size) {
                  setFormError('Salva o annulla le bozze prima di archiviare.');
                  return;
                }
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
                });
              }}
            >
              Archivia
            </Button>
            <span role="status" className="text-xs text-muted-foreground">
              {saving ? 'Salvataggio…' : dirty ? 'Modifiche non salvate' : ''}
            </span>
            {formTab || dirty ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!dirty || saving}
                  onClick={revert}
                >
                  Annulla modifiche
                </Button>
                <Button type="submit" form="card-form" disabled={!dirty || saving}>
                  {saving ? 'Salvataggio…' : 'Salva'}
                </Button>
              </>
            ) : null}
          </>
        )}
      </DialogFooter>
    </Tabs>
  );
}
