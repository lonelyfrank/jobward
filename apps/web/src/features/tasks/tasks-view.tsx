import { createTaskInput, type Task } from '@jobward/schemas';
import type { TaskView } from '@jobward/shared';
import {
  AlarmClock,
  CalendarCheck,
  ListChecks,
  ListTodo,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCreationOperation } from '@/features/cards/creation-operation';
import { LoadError, workflowError } from '@/features/cards/workflow-feedback';
import { cn } from '@/lib/cn';
import { useViewEnter } from '@/hooks/use-view-enter';
import { useTaskActions, useTasks, useTaskSummary, type TaskCommand } from './api';
import {
  sectionOf,
  TASK_SECTION_LABELS,
  TASK_SECTIONS,
  VIEW_LABELS,
  VIEW_PARAMS,
  type TaskSection,
} from './presentation';
import { TaskDialog, type TaskDraft } from './task-dialog';
import { TaskRow } from './task-row';

const VIEWS = ['all', 'open', 'done', 'overdue', 'no_due', 'cancelled'] as const;
const viewFromParam = (param: string | null): TaskView =>
  VIEWS.find((v) => VIEW_PARAMS[v] === param) ?? 'all';

type DialogState = { kind: 'create'; draft?: TaskDraft } | { kind: 'edit'; task: Task } | null;

/** Pagina operativa «Attività»: riepilogo reale, filtri nell'indirizzo, elenco a cursore, crea/modifica. */
export function TasksView() {
  const [params, setParams] = useSearchParams();
  const view = viewFromParam(params.get('vista'));
  const cardId = params.get('candidatura') ?? undefined;
  const notify = useNotify();
  const summary = useTaskSummary();
  const list = useTasks({ view, cardId });
  const actions = useTaskActions();
  const [dialog, setDialog] = useState<DialogState>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const listRef = useViewEnter<HTMLDivElement>(view);
  const focusAt = useRef<number | null>(null);

  const asOf = list.data?.pages[0]?.asOf ?? summary.data?.asOf;
  const tasks = useMemo(() => {
    const seen = new Set<string>();
    return (list.data?.pages ?? [])
      .flatMap((p) => p.tasks)
      .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  }, [list.data]);

  // Dopo che una riga esce dall'elenco, il focus passa alla successiva (o all'intestazione): mai sul body.
  useEffect(() => {
    if (focusAt.current === null) return;
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[data-task-row]') ?? [];
    const target = rows[Math.min(focusAt.current, rows.length - 1)];
    focusAt.current = null;
    const control = target?.querySelector<HTMLElement>('button');
    (control ?? heading.current)?.focus();
  }, [tasks, listRef]);

  const setView = (next: TaskView) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === 'all') p.delete('vista');
        else p.set('vista', VIEW_PARAMS[next]);
        return p;
      },
      { replace: false },
    );
  const clearCard = () =>
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('candidatura');
      return p;
    });

  const run = async (task: Task, command: TaskCommand) => {
    const rows = [...(listRef.current?.querySelectorAll('[data-task-row]') ?? [])];
    const index = rows.findIndex((r) => r.getAttribute('data-task-id') === task.id);
    try {
      await actions.command.mutateAsync({ task, command });
      focusAt.current = index < 0 ? 0 : index;
      notify(
        'success',
        command === 'complete'
          ? 'Attività completata.'
          : command === 'reopen'
            ? 'Attività riaperta.'
            : 'Attività annullata.',
      );
    } catch (error) {
      notify('error', workflowError(error));
    }
  };
  const toggle = (task: Task) => void run(task, task.status === 'done' ? 'reopen' : 'complete');

  const groups = useMemo(() => {
    if (!asOf || (view !== 'all' && view !== 'open')) return null;
    const by = new Map<TaskSection, Task[]>();
    for (const t of tasks) {
      const s = sectionOf(t, asOf);
      if (s) by.set(s, [...(by.get(s) ?? []), t]);
    }
    return TASK_SECTIONS.filter((s) => by.has(s)).map((s) => ({ section: s, tasks: by.get(s)! }));
  }, [tasks, asOf, view]);

  // Vista scelta nel selettore; se si svuota (es. completata l'ultima) si passa alla prima rimasta.
  const [section, setSection] = useState<TaskSection | null>(null);
  const activeSection =
    groups?.find((g) => g.section === section)?.section ?? groups?.[0]?.section ?? null;

  const counts = summary.data?.counts;
  const cardLabel = tasks.find((t) => t.card)?.card;

  return (
    <div className="flex min-h-[24rem] flex-1 flex-col">
      <section
        aria-label="Riepilogo delle attività"
        className="mb-4 grid shrink-0 grid-cols-3 gap-3"
      >
        <SummaryButton
          icon={ListTodo}
          label="Da fare"
          value={counts?.open}
          active={view === 'open'}
          onClick={() => setView('open')}
        />
        <div className="flex items-center gap-3 rounded-lg px-2 py-2" data-testid="summary-today">
          <CalendarCheck
            aria-hidden="true"
            className="size-7 shrink-0 text-primary-soft-foreground max-sm:hidden"
          />
          <div className="min-w-0">
            <p className="text-2xl leading-none font-extrabold tabular-nums">
              {counts?.today ?? '–'}
            </p>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">Oggi</p>
            {counts?.today === 0 ? (
              <p className="hidden text-xs text-muted-foreground sm:block">
                Niente in scadenza oggi
              </p>
            ) : null}
          </div>
        </div>
        <SummaryButton
          icon={AlarmClock}
          label="In ritardo"
          value={counts?.overdue}
          tone={counts && counts.overdue > 0 ? 'danger' : undefined}
          active={view === 'overdue'}
          onClick={() => setView('overdue')}
        />
      </section>

      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filtro delle attività"
          className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-1"
        >
          {VIEWS.map((v) => (
            <Button
              key={v}
              variant={view === v ? 'primary' : 'secondary'}
              size="sm"
              aria-pressed={view === v}
              className="h-8 shrink-0 rounded-full px-3 text-[13px]"
              onClick={() => setView(v)}
            >
              {VIEW_LABELS[v]}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          className="h-9 rounded-full"
          onClick={() => setDialog({ kind: 'create' })}
        >
          <Plus aria-hidden="true" />
          Nuova attività
        </Button>
      </div>

      {cardId ? (
        <p className="mb-3 flex shrink-0 flex-wrap items-center gap-2 text-sm">
          <span>
            Candidatura:{' '}
            <strong>
              {cardLabel
                ? `${cardLabel.company ? cardLabel.company + ' · ' : ''}${cardLabel.title}`
                : 'selezionata'}
            </strong>
          </span>
          <Button variant="ghost" size="sm" onClick={clearCard}>
            Mostra tutte le attività
          </Button>
        </p>
      ) : null}

      {asOf && !cardId ? <QuickAdd /> : null}

      <h2 ref={heading} tabIndex={-1} className="sr-only" id="tasks-list-heading">
        Elenco delle attività: {VIEW_LABELS[view]}
      </h2>
      <p role="status" className="sr-only">
        {list.isSuccess ? `${tasks.length} attività caricate` : ''}
      </p>

      {/* Una vista per volta (In ritardo, Oggi, Prossime…): il selettore resta fermo in alto e le
          righe della vista scelta scorrono nello spazio rimasto. Nessuna sezione si comprime. */}
      <div
        ref={listRef}
        aria-busy={list.isPending}
        className="flex min-h-48 flex-1 flex-col gap-3 overflow-y-auto"
      >
        {list.isPending ? (
          <div className="space-y-2" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : list.isError ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : tasks.length === 0 ? (
          <Empty
            view={view}
            hasCard={Boolean(cardId)}
            total={(counts?.open ?? 0) + (counts?.done ?? 0)}
            done={counts?.done ?? 0}
            onCreate={() => setDialog({ kind: 'create' })}
            onShowAll={() => {
              clearCard();
              setView('all');
            }}
          />
        ) : groups && asOf && activeSection ? (
          <Tabs
            value={activeSection}
            onValueChange={(value) => setSection(value as TaskSection)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList
              variant="pill"
              aria-label="Attività per scadenza"
              className="mx-0 w-fit max-w-full md:mx-0"
            >
              {groups.map(({ section, tasks: rows }) => (
                <TabsTrigger
                  key={section}
                  value={section}
                  className={cn(
                    'group gap-2 px-3.5',
                    section === 'overdue' && 'text-danger data-[state=active]:text-danger',
                  )}
                >
                  {TASK_SECTION_LABELS[section]}
                  <span className="rounded-full bg-surface-muted px-1.5 text-xs tabular-nums group-data-[state=active]:bg-primary-soft">
                    <span className="sr-only"> (</span>
                    {rows.length}
                    <span className="sr-only">)</span>
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            {groups.map(({ section, tasks: rows }) => (
              <TabsContent key={section} value={section} className="mt-2 min-h-0 flex-1">
                <ul
                  aria-label={TASK_SECTION_LABELS[section]}
                  className="h-full overflow-y-auto overscroll-contain pr-1"
                >
                  {rows.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      asOf={asOf}
                      busy={
                        actions.command.isPending && actions.command.variables?.task.id === t.id
                      }
                      onOpen={(task) => setDialog({ kind: 'edit', task })}
                      onToggle={toggle}
                      onCancel={(task) => void run(task, 'cancel')}
                      onReopen={(task) => void run(task, 'reopen')}
                    />
                  ))}
                </ul>
              </TabsContent>
            ))}
          </Tabs>
        ) : asOf ? (
          <ul
            aria-label={VIEW_LABELS[view]}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
          >
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                asOf={asOf}
                busy={actions.command.isPending && actions.command.variables?.task.id === t.id}
                onOpen={(task) => setDialog({ kind: 'edit', task })}
                onToggle={toggle}
                onCancel={(task) => void run(task, 'cancel')}
                onReopen={(task) => void run(task, 'reopen')}
              />
            ))}
          </ul>
        ) : null}
        {list.hasNextPage ? (
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0 self-start rounded-full"
            disabled={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            {list.isFetchingNextPage ? 'Caricamento…' : 'Carica altre attività'}
          </Button>
        ) : null}
      </div>

      {dialog && asOf ? (
        <TaskDialog
          task={dialog.kind === 'edit' ? dialog.task : null}
          {...(dialog.kind === 'create' && dialog.draft ? { draft: dialog.draft } : {})}
          asOf={asOf}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

function SummaryButton({
  icon: Icon,
  label,
  value,
  active,
  tone,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number | undefined;
  active: boolean;
  tone?: 'danger' | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        // Senza sfondo né bordo, come gli indicatori dell'Overview; la vista attiva ha un fondo tenue.
        'flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors duration-100 hover:bg-hover-soft focus-visible:ring-2 focus-visible:ring-primary',
        active && 'bg-primary-soft/60',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          'size-7 shrink-0 max-sm:hidden',
          tone === 'danger' ? 'text-danger' : 'text-primary-soft-foreground',
        )}
      />
      {/* Icona, numero e, a capo, l'etichetta. Nome accessibile = testo visibile («4 Da fare»). */}
      <span className="min-w-0">
        <span
          className={cn(
            'block text-2xl leading-none font-extrabold tabular-nums',
            tone === 'danger' && 'text-danger',
          )}
        >
          {value ?? '–'}
        </span>{' '}
        <span className="mt-1 block text-sm font-semibold text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}

/** Creazione rapida: stessa mutazione e stessa idempotenza del modulo completo (nessuna logica duplicata). */
function QuickAdd() {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const operation = useCreationOperation<ReturnType<typeof createTaskInput.parse>>();
  const { create } = useTaskActions();
  const notify = useNotify();
  const input = useRef<HTMLInputElement>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = createTaskInput.safeParse({ id: operation.id, title });
    if (!parsed.success) {
      setError('Inserisci il titolo.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await create.mutateAsync(operation.capture(parsed.data));
      notify('success', 'Attività creata.');
      setTitle('');
      operation.restart();
      input.current?.focus();
    } catch (e) {
      operation.failed(e);
      setError(workflowError(e));
    } finally {
      setPending(false);
    }
  };
  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      className="mb-3 shrink-0 space-y-1"
      aria-label="Creazione rapida"
    >
      <div className="flex gap-2">
        <Input
          ref={input}
          value={title}
          disabled={pending || operation.locked}
          aria-label="Aggiungi un’attività"
          placeholder="Aggiungi un’attività…"
          maxLength={200}
          className="h-10 rounded-full px-4 max-md:h-11"
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
        />
        <Button
          type="submit"
          size="sm"
          className="h-10 rounded-full max-md:h-11"
          disabled={pending || (!operation.locked && !title.trim())}
        >
          {operation.locked ? 'Riprova' : 'Aggiungi'}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function Empty({
  view,
  hasCard,
  total,
  done,
  onCreate,
  onShowAll,
}: {
  view: TaskView;
  hasCard: boolean;
  total: number;
  done: number;
  onCreate: () => void;
  onShowAll: () => void;
}) {
  let title = 'Nessuna attività, per ora';
  let description =
    'Aggiungi ciò che devi fare: aggiornare il CV, inviare un follow-up, preparare un colloquio.';
  let action: 'create' | 'all' | null = 'create';
  if (hasCard || (total > 0 && view === 'all')) {
    title = 'Nessun risultato con i filtri attuali';
    description = hasCard
      ? 'Non ci sono attività per questa candidatura con il filtro scelto.'
      : 'Prova un altro filtro.';
    action = 'all';
  } else if (view === 'open' && done > 0) {
    title = 'Non hai attività da fare. Ottimo lavoro!';
    description = 'Tutte le attività sono completate. Aggiungine una quando ti serve.';
  } else if (view === 'overdue') {
    title = 'Nessuna attività in ritardo';
    description = 'Le attività da fare con una scadenza passata compariranno qui.';
    action = null;
  } else if (view === 'no_due') {
    title = 'Nessuna attività senza scadenza';
    description = 'Le attività da fare senza una data compariranno qui.';
    action = null;
  } else if (view === 'done') {
    title = 'Nessuna attività completata';
    description = 'Le attività che completi compariranno qui.';
    action = null;
  } else if (view === 'cancelled') {
    title = 'Nessuna attività annullata';
    description = 'Le attività annullate compariranno qui e si potranno riaprire.';
    action = null;
  }
  return (
    <EmptyState icon={ListChecks} title={title} description={description}>
      {action === 'create' ? (
        <Button onClick={onCreate}>
          <Plus aria-hidden="true" />
          Aggiungi la prima attività
        </Button>
      ) : action === 'all' ? (
        <Button variant="secondary" onClick={onShowAll}>
          Mostra tutte
        </Button>
      ) : null}
    </EmptyState>
  );
}

/** Link usato da altre schermate (Overview, candidatura) per aprire l'elenco filtrato. */
export const tasksLink = (cardId?: string) =>
  cardId ? `/tasks?candidatura=${encodeURIComponent(cardId)}` : '/tasks';
