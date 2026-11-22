import type { Column } from '@jobward/schemas';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { useDeleteColumn } from '@/features/boards/api';
import { userMessage } from './mutations';

/**
 * Eliminazione controllata. Le schede non vengono mai eliminate insieme alla colonna:
 * se ce ne sono, bisogna scegliere dove spostarle (anche quelle archiviate).
 */
export function DeleteColumnDialog({
  boardId,
  column,
  otherColumns,
  onClose,
}: {
  boardId: string;
  column: Column;
  otherColumns: Column[];
  onClose: () => void;
}) {
  const remove = useDeleteColumn(boardId);
  const notify = useNotify();
  const total = column.cardCount + column.archivedCount;
  const [target, setTarget] = useState(otherColumns[0]?.id ?? '');

  const submit = () =>
    remove.mutate(
      { columnId: column.id, moveCardsToColumnId: total > 0 ? target : null },
      {
        onSuccess: () => {
          onClose();
          notify(
            'success',
            total > 0
              ? `Colonna “${column.name}” eliminata: le schede sono state spostate.`
              : `Colonna “${column.name}” eliminata.`,
          );
        },
      },
    );

  // Colonna con schede e nessun'altra colonna dove spostarle: l'eliminazione non è possibile.
  if (total > 0 && otherColumns.length === 0) {
    return (
      <ConfirmDialog
        open
        onOpenChange={(open) => !open && onClose()}
        title={`Non puoi eliminare “${column.name}”`}
        description={
          <p>
            Contiene {total} {total === 1 ? 'scheda' : 'schede'} e non c’è un’altra colonna dove
            spostarle. Crea prima un’altra colonna.
          </p>
        }
        confirmLabel="Ho capito"
        onConfirm={onClose}
      />
    );
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Eliminare la colonna “${column.name}”?`}
      description={
        total === 0 ? (
          <p>La colonna è vuota. Questa azione non si può annullare.</p>
        ) : (
          <>
            <p>
              Contiene {total} {total === 1 ? 'scheda' : 'schede'}
              {column.archivedCount > 0 ? ` (${column.archivedCount} archiviate)` : ''}. Non verrà
              eliminata nessuna scheda: saranno spostate in fondo alla colonna che scegli.
            </p>
            <div>
              <label htmlFor="move-target" className="mb-1 block font-medium text-foreground">
                Sposta le schede in
              </label>
              <Select
                id="move-target"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                disabled={remove.isPending}
              >
                {otherColumns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </>
        )
      }
      confirmLabel={total > 0 ? 'Sposta ed elimina' : 'Elimina colonna'}
      pending={remove.isPending}
      error={remove.error ? userMessage(remove.error, 'Qualcosa è andato storto. Riprova.') : null}
      onConfirm={submit}
    />
  );
}
