import { httpUrl, type Card, type CardDocument } from '@jobward/schemas';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useNotify } from '@/components/ui/notices';
import { LoadError, workflowError } from '@/features/cards/workflow-feedback';
import { useDocumentActions, useDocuments } from './api';
import { DocumentForm, DOCUMENT_LABELS } from './document-form';

export function DocumentsTab({ card, active }: { card: Card; active: boolean }) {
  const query = useDocuments(card.id, active);
  const actions = useDocumentActions(card);
  const notify = useNotify();
  const [editor, setEditor] = useState<CardDocument | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CardDocument | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const archived = card.archivedAt !== null;
  useEffect(() => {
    if (editor !== null) return;
    // Il trigger torna abilitato dopo il commit e la chiusura dell'eventuale dialogo di scarto.
    const timer = window.setTimeout(() => trigger.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [editor]);
  const close = () => setEditor(null);
  return (
    <section aria-label="Documenti della candidatura" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Documenti</h3>
          <p className="text-sm text-muted-foreground">
            Riferimenti ai tuoi documenti, senza caricamento di file.
          </p>
        </div>
        {!archived ? (
          <Button
            disabled={editor !== null}
            onClick={(e) => {
              trigger.current = e.currentTarget;
              setEditor('new');
            }}
          >
            Aggiungi riferimento
          </Button>
        ) : null}
      </div>
      {editor !== null ? (
        <DocumentForm
          key={editor === 'new' ? 'new' : editor.id}
          document={editor === 'new' ? null : editor}
          disabled={archived}
          onCreate={async (input) => {
            await actions.create.mutateAsync(input);
            notify('success', 'Riferimento salvato.');
          }}
          onUpdate={async (input) => {
            if (editor !== 'new') await actions.update.mutateAsync({ id: editor.id, input });
            notify('success', 'Riferimento aggiornato.');
          }}
          onRefresh={() => query.refetch({ throwOnError: true })}
          onClose={close}
        />
      ) : null}
      {query.isPending ? <p role="status">Caricamento dei documenti…</p> : null}
      {query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun riferimento documentale registrato.</p>
      ) : null}
      <ul className="space-y-3">
        {query.data?.map((doc) => (
          <li
            key={doc.id}
            className="min-w-0 space-y-2 rounded-lg border border-border p-4 [overflow-wrap:anywhere]"
          >
            <h4 className="text-sm font-semibold">{doc.title}</h4>
            <p className="text-xs text-muted-foreground">{DOCUMENT_LABELS[doc.kind]}</p>
            {doc.note ? <p className="text-sm whitespace-pre-wrap">{doc.note}</p> : null}
            {doc.url && httpUrl.safeParse(doc.url).success ? (
              <Button asChild variant="secondary" size="sm">
                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                  Apri documento<span className="sr-only"> (si apre in una nuova scheda)</span>
                </a>
              </Button>
            ) : null}
            {!archived ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={editor !== null}
                  onClick={(e) => {
                    trigger.current = e.currentTarget;
                    setEditor(doc);
                  }}
                >
                  Modifica riferimento
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={editor !== null}
                  onClick={() => setDeleting(doc)}
                >
                  Elimina riferimento
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            actions.remove.reset();
          }
        }}
        title="Eliminare il riferimento?"
        description={
          <p>Si elimina il riferimento da Jobward. Il documento esterno resta al suo posto.</p>
        }
        confirmLabel="Elimina riferimento"
        pending={actions.remove.isPending}
        error={actions.remove.error ? workflowError(actions.remove.error) : null}
        onConfirm={() => {
          if (deleting)
            actions.remove.mutate(deleting.id, {
              onSuccess: () => {
                setDeleting(null);
                notify('success', 'Riferimento eliminato.');
              },
            });
        }}
      />
    </section>
  );
}
