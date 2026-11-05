import { LIMITS } from '@meet-roulette/shared';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { useBoardDetail, useBoards } from '@/features/boards/api';
import { useCreateCard, userMessage } from './mutations';

/**
 * Creazione rapida da qualunque schermata: bacheca, colonna e titolo. Per chi ha una sola
 * bacheca è un passaggio in meno; senza bacheche rimanda a crearne una.
 */
export function GlobalCreateCardDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const boards = useBoards();
  const [boardId, setBoardId] = useState<string | null>(null);
  const [columnId, setColumnId] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const notify = useNotify();

  const selectedBoardId = boardId ?? boards.data?.[0]?.id ?? '';
  const detail = useBoardDetail(selectedBoardId);
  const create = useCreateCard(selectedBoardId);
  const columns = detail.data?.columns ?? [];
  const selectedColumnId = columns.some((c) => c.id === columnId)
    ? columnId
    : (columns[0]?.id ?? '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim() === '') return setError('Scrivi un titolo per la scheda.');
    setError(null);
    create.mutate(
      { columnId: selectedColumnId, title: title.trim() },
      {
        onSuccess: ({ card }) => {
          onOpenChange(false);
          setTitle('');
          notify('success', `Scheda “${card.title}” creata.`, {
            label: 'Apri',
            onClick: () => void navigate(`/boards/${card.boardId}/cards/${card.id}`),
          });
        },
        onError: (e) => setError(userMessage(e, 'Non siamo riusciti a creare la scheda. Riprova.')),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nuova scheda"
      description="Basta il titolo: il resto lo aggiungi quando vuoi."
    >
      {boards.data && boards.data.length === 0 ? (
        <DialogBody className="space-y-3">
          <p className="text-sm">Per aggiungere una scheda serve prima una bacheca.</p>
          <Button
            onClick={() => {
              onOpenChange(false);
              void navigate('/boards');
            }}
          >
            Vai alle bacheche
          </Button>
        </DialogBody>
      ) : (
        <form noValidate onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogBody className="space-y-4">
            <Field id="gc-title" label="Titolo" error={error ?? undefined}>
              <Input
                id="gc-title"
                value={title}
                maxLength={LIMITS.titleMax}
                autoComplete="off"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'gc-title-error' : undefined}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="gc-board" label="Bacheca">
                <Select
                  id="gc-board"
                  value={selectedBoardId}
                  onChange={(e) => setBoardId(e.target.value)}
                >
                  {(boards.data ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="gc-column" label="Colonna">
                <Select
                  id="gc-column"
                  value={selectedColumnId}
                  disabled={columns.length === 0}
                  onChange={(e) => setColumnId(e.target.value)}
                >
                  {columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {detail.data && columns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Questa bacheca non ha colonne: aggiungine una prima di creare schede.
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={create.isPending || selectedColumnId === ''}>
              {create.isPending ? 'Creo…' : 'Crea scheda'}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
