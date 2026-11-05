import type { CustomField } from '@jobward/schemas';
import { LIMITS } from '@jobward/shared';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogBody } from '@/components/ui/dialog';
import { useNotify } from '@/components/ui/notices';
import { Skeleton } from '@/components/ui/skeleton';
import { userMessage } from '@/features/kanban/mutations';
import { useBoardFields, useDeleteField, useMoveField, useUpdateField } from './api';
import { FieldForm } from './field-form';
import { FIELD_TYPE_LABELS } from './values';

type View = { kind: 'list' } | { kind: 'form'; fieldId: string | null };

/**
 * Configuratore dei campi personalizzati di una bacheca. Elenco → modulo (creazione/modifica) con
 * anteprima. Disattivare è l'azione normale (i valori restano); eliminare è separato e chiede conferma.
 */
export function CustomFieldsDialog({
  boardId,
  boardName,
  open,
  onOpenChange,
}: {
  boardId: string;
  boardName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const notify = useNotify();
  const fields = useBoardFields(boardId, open);
  const update = useUpdateField(boardId);
  const move = useMoveField(boardId);
  const remove = useDeleteField(boardId);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [deleting, setDeleting] = useState<CustomField | null>(null);

  const list = fields.data ?? [];
  const editing = view.kind === 'form' ? (list.find((f) => f.id === view.fieldId) ?? null) : null;

  const toggleActive = (field: CustomField) =>
    update.mutate(
      { fieldId: field.id, input: { isActive: !field.isActive } },
      {
        onSuccess: () =>
          notify(
            'success',
            field.isActive
              ? `Campo “${field.name}” disattivato: i valori sono conservati.`
              : `Campo “${field.name}” riattivato.`,
          ),
        onError: (e) =>
          notify('error', userMessage(e, 'Non siamo riusciti ad aggiornare il campo.')),
      },
    );
  const shift = (index: number, delta: -1 | 1) => {
    const field = list[index];
    if (!field) return;
    // Su: dopo l'elemento che sta due posti sopra; giù: dopo il successivo.
    const afterId = delta === -1 ? (list[index - 2]?.id ?? null) : (list[index + 1]?.id ?? null);
    move.mutate(
      { fieldId: field.id, afterId },
      {
        onError: (e) => notify('error', userMessage(e, 'Non siamo riusciti a riordinare i campi.')),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setView({ kind: 'list' });
      }}
      title={
        view.kind === 'form' ? (editing ? 'Modifica campo' : 'Nuovo campo') : 'Campi personalizzati'
      }
      description={`Informazioni tue per le schede di “${boardName}”.`}
      className="max-w-xl"
    >
      <DialogBody>
        {view.kind === 'form' ? (
          <FieldForm
            key={view.fieldId ?? 'new'}
            boardId={boardId}
            field={editing}
            usedCount={editing?.valueCount ?? 0}
            onDone={() => setView({ kind: 'list' })}
            onCancel={() => setView({ kind: 'list' })}
          />
        ) : fields.isPending ? (
          <div role="status" aria-label="Caricamento dei campi" className="space-y-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : fields.isError ? (
          <p role="alert" className="text-sm text-danger">
            Non riusciamo a caricare i campi.{' '}
            <button type="button" className="underline" onClick={() => void fields.refetch()}>
              Riprova
            </button>
          </p>
        ) : (
          <div className="space-y-4">
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessun campo. Aggiungine uno per registrare ciò che conta nel tuo settore: un albo,
                i turni, uno stack tecnologico, il vitto e alloggio…
              </p>
            ) : (
              <ul
                aria-label="Campi della bacheca"
                className="divide-y divide-border rounded-md border border-border"
              >
                {list.map((field, index) => (
                  <li key={field.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="break-words">{field.name}</span>
                        {!field.isActive ? <Badge tone="warning">Disattivato</Badge> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {FIELD_TYPE_LABELS[field.type]} ·{' '}
                        {field.valueCount === 0
                          ? 'nessun valore'
                          : field.valueCount === 1
                            ? '1 scheda'
                            : `${field.valueCount} schede`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Sposta su “${field.name}”`}
                        disabled={index === 0 || move.isPending}
                        onClick={() => shift(index, -1)}
                      >
                        <ArrowUp aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Sposta giù “${field.name}”`}
                        disabled={index === list.length - 1 || move.isPending}
                        onClick={() => shift(index, 1)}
                      >
                        <ArrowDown aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Modifica “${field.name}”`}
                        onClick={() => setView({ kind: 'form', fieldId: field.id })}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={
                          field.isActive ? `Disattiva “${field.name}”` : `Riattiva “${field.name}”`
                        }
                        disabled={update.isPending}
                        onClick={() => toggleActive(field)}
                      >
                        {field.isActive ? (
                          <EyeOff aria-hidden="true" />
                        ) : (
                          <Eye aria-hidden="true" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Elimina “${field.name}”`}
                        onClick={() => setDeleting(field)}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {list.length} di {LIMITS.customFieldsPerBoardMax} campi. Disattivare un campo lo
                nasconde senza perdere i valori.
              </p>
              <Button
                disabled={list.length >= LIMITS.customFieldsPerBoardMax}
                onClick={() => setView({ kind: 'form', fieldId: null })}
              >
                <Plus aria-hidden="true" />
                Aggiungi campo
              </Button>
            </div>
          </div>
        )}
      </DialogBody>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) {
            setDeleting(null);
            remove.reset();
          }
        }}
        title={`Eliminare “${deleting?.name ?? ''}”?`}
        description={
          deleting && deleting.valueCount > 0 ? (
            <>
              <p>
                Il campo ha valori in {deleting.valueCount}{' '}
                {deleting.valueCount === 1 ? 'scheda' : 'schede'}: eliminandolo andranno persi
                definitivamente.
              </p>
              <p className="font-medium text-foreground">
                Se vuoi solo nasconderlo, usa “Disattiva”: i valori restano e tornano alla
                riattivazione.
              </p>
            </>
          ) : (
            <p>Il campo non ha valori salvati. L’azione non si può annullare.</p>
          )
        }
        confirmLabel={
          deleting && deleting.valueCount > 0 ? 'Elimina campo e valori' : 'Elimina campo'
        }
        pending={remove.isPending}
        error={
          remove.error ? userMessage(remove.error, 'Qualcosa è andato storto. Riprova.') : null
        }
        onConfirm={() =>
          deleting &&
          remove.mutate(
            { fieldId: deleting.id, deleteValues: deleting.valueCount > 0 },
            {
              onSuccess: () => {
                notify('success', `Campo “${deleting.name}” eliminato.`);
                setDeleting(null);
              },
            },
          )
        }
      />
    </Dialog>
  );
}
