import { COLOR_TOKENS, type Board, type ColorToken } from '@jobward/schemas';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { useNotify } from '@/components/ui/notices';
import { userMessage } from '@/features/kanban/mutations';
import { COLOR_LABELS, isColorToken } from '@/lib/labels';
import { useUpdateBoard } from './api';

const OPTIONS = [null, ...COLOR_TOKENS];

/** Il colore è una proprietà della bacheca: si salva con la stessa API della modifica. */
export function BoardBackgroundDialog({
  board,
  onOpenChange,
}: {
  board: Board;
  onOpenChange: (open: boolean) => void;
}) {
  const [color, setColor] = useState<ColorToken | null>(
    isColorToken(board.color) ? board.color : null,
  );
  const update = useUpdateBoard();
  const notify = useNotify();

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      title="Cambia background"
      description="Scegli una tinta unita per questa bacheca."
    >
      <form
        className="flex min-h-0 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (update.isPending) return;
          update.mutate(
            { boardId: board.id, input: { color } },
            {
              onSuccess: () => {
                notify('success', 'Sfondo della bacheca aggiornato.');
                onOpenChange(false);
              },
            },
          );
        }}
      >
        <DialogBody className="space-y-5">
          <div
            aria-hidden="true"
            data-board-color={color ?? 'default'}
            className="board-background grid h-28 grid-cols-3 items-start gap-2 rounded-lg border border-border p-3"
          >
            {[2, 1, 3].map((count, index) => (
              <div key={index} className="space-y-1.5 rounded-md bg-surface-muted p-2">
                <div className="mb-2 h-1.5 w-2/3 rounded bg-muted-foreground/40" />
                {Array.from({ length: count }, (_, item) => (
                  <div key={item} className="h-3 rounded-sm bg-surface" />
                ))}
              </div>
            ))}
          </div>
          <fieldset disabled={update.isPending}>
            <legend className="mb-3 text-sm font-semibold">Tinta unita</legend>
            <div className="grid grid-cols-3 gap-3">
              {OPTIONS.map((option) => (
                <label key={option ?? 'default'} className="relative cursor-pointer">
                  <input
                    type="radio"
                    name="board-background"
                    value={option ?? 'default'}
                    checked={color === option}
                    onChange={() => setColor(option)}
                    className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0"
                  />
                  <span
                    data-board-color={option ?? 'default'}
                    className="board-background flex h-16 items-center justify-center rounded-md border border-border-strong text-foreground peer-checked:ring-2 peer-checked:ring-primary peer-checked:ring-offset-2 peer-checked:ring-offset-surface peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:opacity-60"
                  >
                    {color === option ? <Check aria-hidden="true" className="size-5" /> : null}
                  </span>
                  <span className="mt-1.5 block text-center text-xs font-medium">
                    {option === null ? 'Predefinito' : COLOR_LABELS[option]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {update.isError ? (
            <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">
              {userMessage(update.error, 'Non siamo riusciti a salvare lo sfondo. Riprova.')}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="secondary"
            disabled={update.isPending}
            onClick={() => onOpenChange(false)}
          >
            Annulla
          </Button>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Salvataggio…' : 'Salva sfondo'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
