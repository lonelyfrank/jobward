import { LIMITS } from '@meet-roulette/shared';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateCard, userMessage } from './mutations';

/**
 * Creazione rapida direttamente nella colonna: basta il titolo. Invio aggiunge la scheda e
 * lascia il campo pronto per la successiva (inserimento in serie); Esc chiude e riporta il
 * focus sul pulsante.
 */
export function QuickCreate({
  boardId,
  columnId,
  columnName,
}: {
  boardId: string;
  columnId: string;
  columnName: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const create = useCreateCard(boardId);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      openButtonRef.current?.focus();
    }
  }, [open]);

  const close = () => {
    restoreFocus.current = true;
    setOpen(false);
    setTitle('');
    setError(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed === '') {
      setError('Scrivi un titolo per la scheda.');
      inputRef.current?.focus();
      return;
    }
    setError(null);
    create.mutate(
      { columnId, title: trimmed },
      {
        onSuccess: () => {
          setTitle('');
          inputRef.current?.focus();
        },
        onError: (e) =>
          setError(userMessage(e, 'Non siamo riusciti ad aggiungere la scheda. Riprova.')),
      },
    );
  };

  if (!open) {
    return (
      <Button
        ref={openButtonRef}
        variant="ghost"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden="true" />
        Aggiungi scheda
        <span className="sr-only"> in {columnName}</span>
      </Button>
    );
  }

  const errorId = `quick-create-error-${columnId}`;
  return (
    <form onSubmit={submit} noValidate className="space-y-2">
      <label htmlFor={`quick-create-${columnId}`} className="sr-only">
        Titolo della nuova scheda in {columnName}
      </label>
      <Input
        id={`quick-create-${columnId}`}
        ref={inputRef}
        value={title}
        maxLength={LIMITS.titleMax}
        placeholder="Titolo dell’opportunità"
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        // readOnly e non disabled: un campo disabilitato perde il focus e l'inserimento in serie si interromperebbe.
        readOnly={create.isPending}
        aria-busy={create.isPending}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            close();
          }
        }}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={create.isPending}>
          {create.isPending ? 'Aggiungo…' : 'Aggiungi'}
        </Button>
        <Button size="sm" variant="ghost" onClick={close}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
