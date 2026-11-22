import type { Card, Task } from '@jobward/schemas';
import { derivePipelineStatus, suggestTasks, type TaskSuggestion } from '@jobward/shared';
import { ListTodo, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { useNotify } from '@/components/ui/notices';
import { LoadError, workflowError } from '@/features/cards/workflow-feedback';
import { useInterviews } from '@/features/interviews/api';
import { useWorkspace } from '@/features/workspace/context';
import { useTaskActions, useTasks, type TaskCommand } from './api';
import { dismissSuggestion, isSuggestionDismissed } from './suggestion-storage';
import { TaskDialog, type TaskDraft } from './task-dialog';
import { TaskRow } from './task-row';

const SHOWN = 3;
const SUGGESTION_TEXT = {
  S1: 'Hai inviato la candidatura: vuoi pianificare un follow-up?',
  S2: 'Hai un colloquio in arrivo: vuoi pianificare la preparazione?',
  S3: 'Colloquio completato: vuoi pianificare un follow-up?',
} as const;

type DialogState = { kind: 'create'; draft: TaskDraft } | { kind: 'edit'; task: Task } | null;

/**
 * Attività collegate alla candidatura (Panoramica). Mostra le aperte con la scadenza evidenziata,
 * permette di crearne (anche un follow-up) e propone — senza mai creare nulla — le azioni dei
 * suggerimenti deterministici. Candidatura archiviata: sola lettura.
 */
export function CardTasksSection({ card, archived }: { card: Card; archived: boolean }) {
  const { workspace } = useWorkspace();
  const notify = useNotify();
  const actions = useTaskActions();
  const all = useTasks({ view: 'all', cardId: card.id });
  const cancelled = useTasks({ view: 'cancelled', cardId: card.id });
  const interviews = useInterviews(card.id);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dismissedTick, setDismissedTick] = useState(0);

  const asOf = all.data?.pages[0]?.asOf;
  const everyTask = useMemo(
    () => [...(all.data?.pages ?? []), ...(cancelled.data?.pages ?? [])].flatMap((p) => p.tasks),
    [all.data, cancelled.data],
  );
  const open = everyTask.filter((t) => t.status === 'open');
  const complete =
    all.isSuccess && cancelled.isSuccess && !all.hasNextPage && !cancelled.hasNextPage;

  const suggestion: TaskSuggestion | null = useMemo(() => {
    if (archived || !asOf || !complete || !interviews.isSuccess) return null;
    void dismissedTick;
    const dismissed = new Set(
      [
        `S1:${card.appliedOn ?? 'none'}`,
        ...interviews.data.flatMap((i) => [`S2:${i.id}`, `S3:${i.id}`]),
      ].filter((key) => isSuggestionDismissed(workspace.id, key)),
    );
    return (
      suggestTasks({
        status: derivePipelineStatus(card),
        appliedOn: card.appliedOn,
        company: card.company,
        tasks: everyTask.map((t) => ({ kind: t.kind, status: t.status, createdAt: t.createdAt })),
        interviews: interviews.data.map((i) => ({
          id: i.id,
          sequence: i.sequence,
          status: i.status,
          scheduledAt: i.scheduledAt,
          completedAt: i.completedAt,
          createdAt: i.createdAt,
        })),
        today: asOf.today,
        timeZone: asOf.timeZone,
        dismissed,
      })[0] ?? null
    );
  }, [
    archived,
    asOf,
    complete,
    interviews.isSuccess,
    interviews.data,
    card,
    everyTask,
    workspace.id,
    dismissedTick,
  ]);

  const picked = { id: card.id, title: card.title, company: card.company };
  const run = async (task: Task, command: TaskCommand) => {
    try {
      await actions.command.mutateAsync({ task, command });
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

  return (
    <section
      aria-label="Attività della candidatura"
      className="rounded-lg border border-border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <ListTodo aria-hidden="true" className="size-3.5" />
          Attività
        </h3>
        {!archived ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setDialog({
                  kind: 'create',
                  draft: {
                    title: `Follow-up: ${card.company?.trim() || card.title}`,
                    kind: 'follow_up',
                    card: picked,
                    fixedCard: true,
                  },
                })
              }
            >
              Pianifica un follow-up
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setDialog({ kind: 'create', draft: { card: picked, fixedCard: true } })
              }
            >
              <Plus aria-hidden="true" />
              Aggiungi attività
            </Button>
          </div>
        ) : null}
      </div>

      {archived ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          La candidatura è archiviata: le sue attività sono in sola lettura. Ripristinala per
          modificarle.
        </p>
      ) : null}

      {suggestion ? (
        <aside
          aria-label="Suggerimento"
          className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-primary-soft px-3 py-2 text-sm text-primary-soft-foreground"
        >
          <p className="min-w-0 flex-1 basis-56">{SUGGESTION_TEXT[suggestion.rule]}</p>
          <Button
            size="sm"
            onClick={() =>
              setDialog({
                kind: 'create',
                draft: {
                  title: suggestion.title,
                  kind: suggestion.kind,
                  dueOn: suggestion.dueOn,
                  card: picked,
                  fixedCard: true,
                },
              })
            }
          >
            Pianifica
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              dismissSuggestion(workspace.id, suggestion.key);
              setDismissedTick((n) => n + 1);
            }}
          >
            Non ora
          </Button>
        </aside>
      ) : null}

      <div className="mt-2" aria-busy={all.isPending}>
        {all.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Caricamento delle attività…
          </p>
        ) : all.isError ? (
          <LoadError error={all.error} onRetry={() => void all.refetch()} />
        ) : open.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessuna attività aperta per questa candidatura.
          </p>
        ) : asOf ? (
          <ul aria-label="Attività aperte">
            {open.slice(0, SHOWN).map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                asOf={asOf}
                compact
                readOnly={archived}
                busy={actions.command.isPending && actions.command.variables?.task.id === t.id}
                onOpen={(task) => setDialog({ kind: 'edit', task })}
                onToggle={(task) => void run(task, task.status === 'done' ? 'reopen' : 'complete')}
                onCancel={(task) => void run(task, 'cancel')}
                onReopen={(task) => void run(task, 'reopen')}
              />
            ))}
          </ul>
        ) : null}
        {open.length > 0 || everyTask.length > 0 ? (
          <Link
            to={`/tasks?candidatura=${encodeURIComponent(card.id)}`}
            className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
          >
            {open.length > SHOWN
              ? `Vedi tutte (${open.length} aperte)`
              : 'Apri nell’elenco delle attività'}
          </Link>
        ) : null}
      </div>

      {dialog && asOf ? (
        <TaskDialog
          task={dialog.kind === 'edit' ? dialog.task : null}
          {...(dialog.kind === 'create' ? { draft: dialog.draft } : {})}
          asOf={asOf}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </section>
  );
}
