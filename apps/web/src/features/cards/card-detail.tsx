import type { Card, Column } from '@jobward/schemas';
import type { Priority } from '@jobward/shared';
import {
  Archive,
  ArrowRight,
  Banknote,
  Building2,
  ChartNoAxesColumn,
  Clock,
  ExternalLink,
  FileText,
  Heart,
  History,
  LayoutDashboard,
  Link2,
  MapPin,
  MoreHorizontal,
  Plus,
  Video,
} from 'lucide-react';
import { lazy, Suspense, useContext, useState, type FormEvent, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogCloseButton } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotify } from '@/components/ui/notices';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApplicationsPanel } from '@/features/applications/applications-panel';
import { useCardFields, usePutFieldValue } from '@/features/custom-fields/api';
import { sameValue, valueFromDraft, type FieldDraft } from '@/features/custom-fields/values';
import { InterviewsTab } from '@/features/interviews/interviews-tab';
import {
  useArchiveCard,
  useMoveCard,
  useRestoreCard,
  useUpdateCard,
  userMessage,
} from '@/features/kanban/mutations';
import { useCardLabels } from '@/features/labels/api';
import { useOpportunityCities } from '@/features/opportunities/api';
import { PipelinePanel } from '@/features/pipeline/pipeline-panel';
import { CardTasksSection } from '@/features/tasks/card-tasks-section';
import { ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateTime, formatRelative } from '@/lib/format';
import { CONTRACT_LABELS, SENIORITY_LABELS, WORK_MODE_LABELS } from '@/lib/labels';
import { formatSalary } from '@/lib/salary';
import { CardDetailsPanel } from './card-details-panel';
import {
  buildChanges,
  draftFromCard,
  serverFieldErrors,
  type CardDraft,
  type DraftErrors,
} from './card-form';
import { NextSteps, Organization } from './card-side-panel';
import { DirtyGuardContext, useDirtyReporter } from './dirty-guard';
import {
  CARD_SECTIONS,
  HISTORY_VIEWS,
  isHistoryView,
  sectionOf,
  type CardSection,
  type CardTab,
  type HistoryView,
} from './workspace-tabs';

const NotesTab = lazy(() =>
  import('@/features/notes/notes-tab').then((m) => ({ default: m.NotesTab })),
);
const DocumentsTab = lazy(() =>
  import('@/features/documents/documents-tab').then((m) => ({ default: m.DocumentsTab })),
);
const TimelineTab = lazy(() =>
  import('@/features/timeline/timeline-tab').then((m) => ({ default: m.TimelineTab })),
);

const SECTION_ICONS: Record<CardSection, ReactNode> = {
  overview: <LayoutDashboard aria-hidden="true" />,
  interviews: <Video aria-hidden="true" />,
  history: <History aria-hidden="true" />,
  details: <FileText aria-hidden="true" />,
};

/**
 * Modale della candidatura. Quattro schede (Panoramica, Colloqui, Storico, Dettagli) e, accanto,
 * il pannello dello stato sempre visibile (sotto `lg` sta in cima alla Panoramica).
 *
 * Salvataggio unico: tutto ciò che si modifica sulla scheda (dettagli, campi personalizzati,
 * colonna, priorità, etichette) resta in bozza finché non si preme «Salva» nella barra in basso,
 * da qualunque scheda; si inviano SOLO i valori cambiati. Fase ed esito passano dalla pipeline con
 * conferma; note, documenti, colloqui e candidature sono record a sé, con il proprio «Salva».
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
  const [createSignal, setCreateSignal] = useState(0);
  const [visited, setVisited] = useState<Set<CardTab>>(() => new Set([tab]));
  if (!visited.has(tab)) setVisited(new Set([...visited, tab]));
  const [lastHistory, setLastHistory] = useState<HistoryView>(
    isHistoryView(tab) ? tab : 'timeline',
  );
  if (isHistoryView(tab) && tab !== lastHistory) setLastHistory(tab);
  const section = sectionOf(tab);

  const update = useUpdateCard(boardId);
  const move = useMoveCard(boardId);
  const archive = useArchiveCard(boardId);
  const restore = useRestoreCard(boardId);
  const cardLabels = useCardLabels(card.id, boardId);

  const archived = card.archivedAt !== null;
  const [draft, setDraft] = useState<CardDraft>(() => draftFromCard(card));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  // Colonna ed etichette in bozza: `null` = non toccate (seguono il valore salvato).
  const [columnDraft, setColumnDraft] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState<string[] | null>(null);

  // Campi personalizzati: si tengono SOLO le bozze modificate, gli altri mostrano il valore salvato.
  const customFields = useCardFields(card.id);
  const putValue = usePutFieldValue(card.id);
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, FieldDraft>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Se la scheda cambia da fuori (pipeline, altro dispositivo) i campi che l'utente NON ha toccato
  // seguono il valore salvato; quelli in modifica restano com'erano.
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
  const built = buildChanges(draft, card);
  const cardDirty = Object.keys(built.changes).length > 0;
  // Le modifiche sono quelle che si invierebbero (stessa normalizzazione: «eur» = «EUR», spazi…).
  const changedKeys = [
    ...new Set(
      Object.keys(built.changes).map((key) =>
        key === 'latitude' || key === 'longitude' ? 'coordinates' : key,
      ),
    ),
  ];

  const fieldPlan = (customFields.data ?? []).flatMap((entry) => {
    const edited = fieldDrafts[entry.field.id];
    if (edited === undefined) return [];
    const result = valueFromDraft(entry.field, edited);
    if (result.ok && sameValue(result.value, entry.value)) return [];
    return [{ entry, result }];
  });

  const columnId = columnDraft ?? card.columnId;
  const columnDirty = columnDraft !== null && columnDraft !== card.columnId;
  const labelIds = labelDraft ?? card.labelIds;
  const labelsAdded = labelDraft ? labelDraft.filter((id) => !card.labelIds.includes(id)) : [];
  const labelsRemoved = labelDraft ? card.labelIds.filter((id) => !labelDraft.includes(id)) : [];
  const labelsDirty = labelsAdded.length + labelsRemoved.length > 0;

  const detailsDirty = changedKeys.some((k) => k !== 'priority') || fieldPlan.length > 0;
  const organizationDirty = columnDirty || labelsDirty || changedKeys.includes('priority');
  const dirty = cardDirty || fieldPlan.length > 0 || columnDirty || labelsDirty;
  const changeCount =
    changedKeys.length + fieldPlan.length + (columnDirty ? 1 : 0) + (labelsDirty ? 1 : 0);
  const hasErrors = Object.values(errors).some(Boolean) || Object.keys(fieldErrors).length > 0;
  useDirtyReporter('card-form', dirty);
  const showEdit = !archived && (editing || detailsDirty || hasErrors);

  const requestInterview = () => {
    onTabChange('interviews');
    setCreateSignal((n) => n + 1);
  };

  const save = async () => {
    setFormError(null);
    // Differenze solo di forma (es. «01800» e «1800»): niente da inviare, la bozza si riallinea.
    if (!cardDirty && fieldPlan.length === 0 && !columnDirty && !labelsDirty) {
      setDraft(draftFromCard(card));
      setEditing(false);
      return;
    }
    // Prima si valida tutto: nessuna richiesta parte se qualcosa non è valido.
    const nextFieldErrors: Record<string, string> = {};
    for (const { entry, result } of fieldPlan) {
      if (!result.ok) nextFieldErrors[entry.field.id] = result.message;
    }
    if ((cardDirty && !built.input) || Object.keys(nextFieldErrors).length > 0) {
      setErrors(cardDirty ? built.errors : {});
      setFieldErrors(nextFieldErrors);
      setEditing(true);
      onTabChange('details');
      return;
    }
    setErrors({});
    setFieldErrors({});
    setSaving(true);

    // Ogni parte è una richiesta indipendente: se una fallisce le altre restano salvate e la bozza
    // di ciò che non è andato a buon fine NON viene toccata.
    let failedMessage: string | null = null;
    let saved: Card | null = null;
    if (built.input) {
      try {
        saved = (await update.mutateAsync({ cardId: card.id, input: built.input })).card;
      } catch (e) {
        if (e instanceof ApiRequestError && e.status === 400) {
          setErrors(serverFieldErrors(e.issues));
          setEditing(true);
          failedMessage = 'Controlla i campi evidenziati.';
        } else {
          failedMessage = userMessage(e, 'Non siamo riusciti a salvare. Riprova.');
        }
      }
    }
    if (columnDirty && columnDraft) {
      try {
        await move.mutateAsync({
          cardId: card.id,
          columnId: columnDraft,
          afterCardId: lastCardIdOf(columnDraft),
        });
        setColumnDraft(null);
      } catch (e) {
        failedMessage ??= userMessage(e, 'Non siamo riusciti a spostare la scheda.');
      }
    }

    const writtenFields = fieldPlan.flatMap(({ entry, result }) =>
      result.ok ? [{ entry, value: result.value }] : [],
    );
    const [fieldOutcomes, labelOutcomes] = await Promise.all([
      Promise.allSettled(
        writtenFields.map(({ entry, value }) =>
          putValue.mutateAsync({ fieldId: entry.field.id, value }),
        ),
      ),
      Promise.allSettled([
        ...labelsAdded.map((id) => cardLabels.assign.mutateAsync(id)),
        ...labelsRemoved.map((id) => cardLabels.unassign.mutateAsync(id)),
      ]),
    ]);
    setSaving(false);

    const savedIds: string[] = [];
    const failedFields: Record<string, string> = {};
    writtenFields.forEach(({ entry }, i) => {
      const outcome = fieldOutcomes[i];
      if (outcome?.status === 'fulfilled') savedIds.push(entry.field.id);
      else {
        const e = outcome?.reason as unknown;
        failedFields[entry.field.id] =
          e instanceof ApiRequestError && e.issues?.[0]
            ? e.issues[0].message
            : userMessage(e, 'Non siamo riusciti a salvare questo campo.');
      }
    });
    if (savedIds.length > 0) {
      setFieldDrafts((d) =>
        Object.fromEntries(Object.entries(d).filter(([id]) => !savedIds.includes(id))),
      );
    }
    setFieldErrors(failedFields);
    if (Object.keys(failedFields).length > 0) {
      setEditing(true);
      failedMessage ??= 'Controlla i campi evidenziati.';
    }
    // Le etichette riuscite aggiornano già la scheda: la bozza resta solo se qualcosa è fallito.
    if (labelOutcomes.some((o) => o.status === 'rejected')) {
      failedMessage ??= 'Non siamo riusciti ad aggiornare tutte le etichette.';
    } else setLabelDraft(null);

    if (failedMessage) setFormError(failedMessage);
    else {
      // La bozza riprende i valori come li ha salvati il server (es. valuta in maiuscolo).
      if (saved) setDraft(draftFromCard(saved));
      setEditing(false);
      notify('success', 'Modifiche salvate.');
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (dirty && !saving) void save();
  };

  const revert = () => {
    setDraft(draftFromCard(card));
    setErrors({});
    setFieldDrafts({});
    setFieldErrors({});
    setColumnDraft(null);
    setLabelDraft(null);
    setFormError(null);
    setEditing(false);
  };

  const archiveCard = () => {
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
      onError: (e) => setFormError(userMessage(e, 'Non siamo riusciti ad archiviare la scheda.')),
    });
  };
  const restoreCard = () =>
    restore.mutate(card.id, {
      onSuccess: () => notify('success', 'Scheda ripristinata.'),
      onError: (e) => setFormError(userMessage(e, 'Non siamo riusciti a ripristinare la scheda.')),
    });

  const cities = useOpportunityCities().data?.cities.map((c) => c.city) ?? [];
  const place = [card.city || card.location, card.workMode ? WORK_MODE_LABELS[card.workMode] : null]
    .filter(Boolean)
    .join(' · ');
  const initial = (card.company?.trim() || card.title).charAt(0).toUpperCase();

  const changeSection = (next: string) => {
    const entry = CARD_SECTIONS.find((s) => s.id === next);
    if (!entry) return;
    onTabChange(entry.id === 'history' ? lastHistory : entry.tab);
  };

  return (
    <Tabs value={section} onValueChange={changeSection} className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-start gap-3 px-4 pt-4 md:gap-4 md:px-6 md:pt-5">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-primary-soft text-lg font-extrabold text-primary-soft-foreground md:size-12 md:text-xl"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          {/* Il nome accessibile della finestra è il titolo sr-only del Dialog: qui solo presentazione. */}
          <p
            aria-hidden="true"
            className="text-xl leading-tight font-extrabold tracking-tight break-words md:text-[22px]"
          >
            {card.title}
          </p>
          <ul
            aria-label="In sintesi"
            className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0"
          >
            <li className="inline-flex min-w-0 items-center gap-1.5">
              <Building2 aria-hidden="true" />
              {card.company || 'Azienda non indicata'}
            </li>
            {place ? (
              <li className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin aria-hidden="true" />
                {place}
              </li>
            ) : null}
            <li className="inline-flex items-center gap-1.5 max-sm:hidden">
              <Clock aria-hidden="true" />
              <time
                dateTime={new Date(card.updatedAt).toISOString()}
                title={formatDateTime(card.updatedAt, timeZone)}
              >
                Aggiornata {formatRelative(card.updatedAt, timeZone)}
              </time>
            </li>
            {archived ? (
              <li>
                <Badge tone="warning">Archiviata</Badge>
              </li>
            ) : null}
          </ul>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {card.sourceUrl ? (
            <Button asChild variant="secondary" size="sm" className="rounded-xl max-md:hidden">
              <a href={card.sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                Apri annuncio<span className="sr-only"> (si apre in una nuova scheda)</span>
              </a>
            </Button>
          ) : null}
          {!archived ? (
            <Button size="sm" className="rounded-xl max-md:hidden" onClick={requestInterview}>
              <Plus aria-hidden="true" />
              Colloquio
            </Button>
          ) : null}
          {!archived ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl"
                  aria-label="Altre azioni"
                  disabled={archive.isPending}
                >
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={archiveCard}>
                  <Archive aria-hidden="true" className="size-4" />
                  Archivia
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <DialogCloseButton className="rounded-xl" />
        </div>
      </header>

      <TabsList
        aria-label="Sezioni della candidatura"
        className="mt-2 gap-0 px-1 md:mt-3 md:gap-1 md:px-4"
      >
        {CARD_SECTIONS.map((entry) => (
          <TabsTrigger
            key={entry.id}
            value={entry.id}
            className="group min-h-12 gap-1.5 px-2.5 max-sm:text-[13px] md:gap-2 md:px-3 [&_svg]:size-4"
          >
            {SECTION_ICONS[entry.id]}
            {entry.label}
            {entry.id === 'interviews' && card.interviewSummary.total > 0 ? (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-surface-muted px-1.5 text-xs font-bold group-data-[state=active]:bg-primary-soft">
                <span className="sr-only"> (</span>
                {card.interviewSummary.total}
                <span className="sr-only">)</span>
              </span>
            ) : null}
            {entry.id === 'details' && detailsDirty ? (
              <span
                aria-hidden="true"
                title="Modifiche non salvate"
                className="size-2 rounded-full bg-warning-soft-foreground"
              />
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-muted lg:flex-row lg:overflow-hidden lg:bg-surface">
        {/* Stato e organizzazione: a destra da `lg`, in cima alla Panoramica sotto. */}
        <aside
          aria-label="Stato e organizzazione"
          className={cn(
            'flex flex-col gap-4 px-4 pt-4 md:px-6 lg:order-last lg:w-74 lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-border lg:bg-surface-muted lg:p-5',
            section !== 'overview' && 'max-lg:hidden',
          )}
        >
          <PipelinePanel card={card} signal={pipelineSignal} disabled={archived} />
          <NextSteps
            card={card}
            timeZone={timeZone}
            onOpenInterviews={() => onTabChange('interviews')}
          />
          <Organization
            card={card}
            columns={columns}
            columnId={columnId}
            priority={draft.priority}
            labelIds={labelIds}
            disabled={archived || saving}
            dirty={organizationDirty}
            onColumn={(id) => setColumnDraft(id === card.columnId ? null : id)}
            onPriority={(p: Priority) => set('priority', p)}
            onLabels={setLabelDraft}
          />
        </aside>

        <div className="flex flex-col gap-5 p-4 md:p-6 lg:min-h-0 lg:min-w-0 lg:flex-1 lg:overflow-y-auto">
          {archived ? (
            <div
              role="status"
              className="flex flex-wrap items-center gap-3 rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm text-warning-soft-foreground"
            >
              <Archive aria-hidden="true" className="size-4 shrink-0" />
              <p className="min-w-0 flex-1 basis-56">
                Questa scheda è archiviata e non compare nella bacheca. Ripristinala per
                modificarla.
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-xl"
                disabled={restore.isPending}
                onClick={restoreCard}
              >
                Ripristina scheda
              </Button>
            </div>
          ) : null}
          {formError ? (
            <p
              role="alert"
              className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger"
            >
              {formError}
            </p>
          ) : null}

          <TabsContent value="overview" className="space-y-5">
            <InBrief card={card} onAllDetails={() => onTabChange('details')} />
            <CardTasksSection card={card} archived={archived} />
            <ApplicationsPanel card={card} />
          </TabsContent>

          <TabsContent value="interviews">
            <InterviewsTab
              card={card}
              archived={archived}
              createSignal={createSignal}
              stagePending={false}
              onSetStage={() => setPipelineSignal((n) => n + 1)}
            />
          </TabsContent>

          <TabsContent value="history">
            <Tabs value={lastHistory} onValueChange={(v) => onTabChange(v as HistoryView)}>
              <TabsList
                variant="pill"
                aria-label="Viste dello storico"
                className="mx-0 mb-4 w-fit max-w-full md:mx-0"
              >
                {HISTORY_VIEWS.map((view) => (
                  <TabsTrigger key={view.id} value={view.id}>
                    {view.label}
                  </TabsTrigger>
                ))}
              </TabsList>
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
            </Tabs>
          </TabsContent>

          <TabsContent value="details">
            <form id="card-form" noValidate onSubmit={submit}>
              <CardDetailsPanel
                card={card}
                draft={draft}
                errors={errors}
                editing={showEdit}
                archived={archived}
                cities={cities}
                custom={{
                  fields: customFields.data,
                  drafts: fieldDrafts,
                  errors: fieldErrors,
                  loading: customFields.isPending,
                  failed: customFields.isError,
                  onRetry: () => void customFields.refetch(),
                  onChange: (fieldId, value) => {
                    setFieldDrafts((d) => ({ ...d, [fieldId]: value }));
                    setFieldErrors((e) => {
                      if (!e[fieldId]) return e;
                      const { [fieldId]: _removed, ...rest } = e;
                      return rest;
                    });
                  },
                }}
                onEdit={() => setEditing(true)}
                onDone={detailsDirty || hasErrors ? null : () => setEditing(false)}
                set={set}
              />
            </form>
          </TabsContent>
        </div>
      </div>

      {!archived && (dirty || saving) ? (
        <div
          role="region"
          aria-label="Modifiche da salvare"
          className="flex shrink-0 flex-wrap items-center gap-2.5 border-t border-border bg-warning-soft px-4 py-2.5 md:px-6"
        >
          <span
            role="status"
            className="mr-auto text-sm font-semibold text-warning-soft-foreground"
          >
            {saving
              ? 'Salvataggio…'
              : changeCount === 1
                ? '1 modifica non salvata'
                : `${changeCount} modifiche non salvate`}
          </span>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-xl"
            aria-label="Annulla modifiche"
            disabled={saving}
            onClick={revert}
          >
            Annulla
          </Button>
          <Button size="sm" className="rounded-xl" disabled={saving} onClick={() => void save()}>
            {saving ? 'Salvataggio…' : 'Salva'}
          </Button>
        </div>
      ) : !archived ? (
        // Telefono: le azioni principali restano a portata di pollice.
        <div className="flex shrink-0 gap-2 border-t border-border bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
          {card.sourceUrl ? (
            <Button asChild variant="secondary" className="flex-1 rounded-xl">
              <a href={card.sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                Apri annuncio<span className="sr-only"> (si apre in una nuova scheda)</span>
              </a>
            </Button>
          ) : null}
          <Button className="flex-1 rounded-xl" onClick={requestInterview}>
            <Plus aria-hidden="true" />
            Colloquio
          </Button>
        </div>
      ) : null}
    </Tabs>
  );
}

/** «In breve»: i dati che servono per decidere, come piastrine con icona. Solo dati registrati. */
function InBrief({ card, onAllDetails }: { card: Card; onAllDetails: () => void }) {
  const facts: { icon: ReactNode; label: string; value: string | null }[] = [
    {
      icon: <MapPin />,
      label: 'Sede',
      value:
        [card.city || card.location, card.workMode ? WORK_MODE_LABELS[card.workMode] : null]
          .filter(Boolean)
          .join(' · ') || null,
    },
    { icon: <Banknote />, label: 'Retribuzione', value: formatSalary(card) },
    {
      icon: <FileText />,
      label: 'Contratto',
      value: card.contractType ? CONTRACT_LABELS[card.contractType] : null,
    },
    {
      icon: <ChartNoAxesColumn />,
      label: 'Livello',
      value: card.seniority ? SENIORITY_LABELS[card.seniority] : null,
    },
    {
      icon: <Heart />,
      label: 'Il tuo interesse',
      value: card.interest ? `${card.interest} su 5` : null,
    },
    { icon: <Link2 />, label: 'Fonte', value: card.source },
  ];
  return (
    <section
      aria-labelledby={`brief-${card.id}`}
      className="@container rounded-2xl border border-border bg-surface p-4"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <LayoutDashboard aria-hidden="true" className="size-5 text-primary-soft-foreground" />
        <h2 id={`brief-${card.id}`} className="flex-1 text-[17px] font-bold">
          In breve
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-xl text-primary-soft-foreground hover:bg-primary-soft"
          onClick={onAllDetails}
        >
          Tutti i dettagli
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-4 @lg:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="relative min-h-9 min-w-0 pl-12">
            <dt className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              <span
                aria-hidden="true"
                className="absolute top-0 left-0 grid size-9 place-items-center rounded-[10px] bg-surface-muted text-muted-foreground [&_svg]:size-5"
              >
                {f.icon}
              </span>
              {f.label}
            </dt>
            <dd
              className={cn(
                'text-sm font-semibold [overflow-wrap:anywhere]',
                !f.value && 'font-normal text-muted-foreground',
              )}
            >
              {f.value ?? 'Non indicato'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
