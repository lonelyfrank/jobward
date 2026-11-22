import type { Card, Note } from '@jobward/schemas';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useNotify } from '@/components/ui/notices';
import { LoadError, workflowError } from '@/features/cards/workflow-feedback';
import { formatDateTime } from '@/lib/format';
import { useNoteActions, useNotes } from './api';
import { NoteForm } from './note-form';

export function NotesTab({
  card,
  active,
  timeZone,
}: {
  card: Card;
  active: boolean;
  timeZone: string;
}) {
  const query = useNotes(card.id, active);
  const actions = useNoteActions(card);
  const notify = useNotify();
  const [editor, setEditor] = useState<Note | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Note | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const archived = card.archivedAt !== null;
  const seen = new Set<string>();
  const notes = (query.data?.pages.flatMap((p) => p.notes) ?? []).filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
  useEffect(() => {
    if (editor !== null) return;
    // Il trigger torna abilitato dopo il commit e la chiusura dell'eventuale dialogo di scarto.
    const timer = window.setTimeout(() => trigger.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [editor]);
  const close = () => setEditor(null);
  return (
    <section aria-label="Note della candidatura" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Note</h3>
        {!archived ? (
          <Button
            disabled={editor !== null}
            onClick={(e) => {
              trigger.current = e.currentTarget;
              setEditor('new');
            }}
          >
            Aggiungi nota
          </Button>
        ) : null}
      </div>
      {editor !== null ? (
        <NoteForm
          key={editor === 'new' ? 'new' : editor.id}
          note={editor === 'new' ? null : editor}
          disabled={archived}
          onCreate={async (input) => {
            await actions.create.mutateAsync(input);
            notify('success', 'Nota salvata.');
          }}
          onUpdate={async (body) => {
            if (editor !== 'new') await actions.update.mutateAsync({ id: editor.id, body });
            notify('success', 'Nota aggiornata.');
          }}
          onRefresh={() => query.refetch({ throwOnError: true })}
          onClose={close}
        />
      ) : null}
      {query.isPending ? <p role="status">Caricamento delle note…</p> : null}
      {query.isError ? (
        <LoadError
          error={query.error}
          onRetry={() => {
            if (query.isFetchNextPageError) void query.fetchNextPage();
            else void query.refetch();
          }}
        />
      ) : null}
      {!query.isPending && !query.isError && !notes.length ? (
        <p className="text-sm text-muted-foreground">Nessuna nota registrata.</p>
      ) : null}
      <ol className="space-y-3">
        {notes.map((note) => (
          <li key={note.id} className="min-w-0 rounded-lg border border-border p-4">
            <time
              className="text-xs text-muted-foreground"
              dateTime={new Date(note.updatedAt).toISOString()}
            >
              {formatDateTime(note.updatedAt, timeZone)}
            </time>
            <p className="mt-1 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{note.body}</p>
            {!archived ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={editor !== null}
                  onClick={(e) => {
                    trigger.current = e.currentTarget;
                    setEditor(note);
                  }}
                >
                  Modifica nota
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={editor !== null}
                  onClick={() => setDeleting(note)}
                >
                  Elimina nota
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      {query.hasNextPage ? (
        <Button
          variant="secondary"
          disabled={query.isFetching}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? 'Caricamento…' : 'Carica altre note'}
        </Button>
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            actions.remove.reset();
          }
        }}
        title="Eliminare la nota?"
        description={
          <p>
            La nota sarà eliminata anche dalla Timeline. Questa operazione non si può annullare.
          </p>
        }
        confirmLabel="Elimina nota"
        pending={actions.remove.isPending}
        error={actions.remove.error ? workflowError(actions.remove.error) : null}
        onConfirm={() => {
          if (deleting)
            actions.remove.mutate(deleting.id, {
              onSuccess: () => {
                setDeleting(null);
                notify('success', 'Nota eliminata.');
              },
            });
        }}
      />
    </section>
  );
}
