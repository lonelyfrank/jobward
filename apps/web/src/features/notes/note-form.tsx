import {
  createNoteInput,
  updateNoteInput,
  type CreateNoteInput,
  type Note,
} from '@jobward/schemas';
import { LIMITS } from '@jobward/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { useCreationOperation } from '@/features/cards/creation-operation';
import { useDirtyReporter } from '@/features/cards/dirty-guard';
import { workflowError } from '@/features/cards/workflow-feedback';

export function NoteForm({
  note,
  disabled,
  onCreate,
  onUpdate,
  onRefresh,
  onClose,
}: {
  note: Note | null;
  disabled: boolean;
  onCreate: (input: CreateNoteInput) => Promise<unknown>;
  onUpdate: (body: string) => Promise<unknown>;
  onRefresh: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [body, setBody] = useState(note?.body ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);
  const operation = useCreationOperation<CreateNoteInput>();
  const dirty = body !== (note?.body ?? '') || operation.locked || pending;
  useDirtyReporter('note-editor', dirty);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = updateNoteInput.safeParse({ body });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(' · '));
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (note) await onUpdate(parsed.data.body);
      else
        await onCreate(
          operation.capture(createNoteInput.parse({ id: operation.id, body: parsed.data.body })),
        );
      onClose();
    } catch (e) {
      if (!note) operation.failed(e);
      setError(workflowError(e));
    } finally {
      setPending(false);
    }
  };
  return (
    <form
      aria-label={note ? 'Modifica nota' : 'Nuova nota'}
      onSubmit={(e) => void submit(e)}
      noValidate
      className="space-y-3 rounded-lg border border-border-strong p-4"
    >
      <Field
        id="note-body"
        label="Testo della nota"
        hint={`${body.length.toLocaleString('it-IT')} / 10.000 caratteri`}
      >
        <Textarea
          ref={input}
          id="note-body"
          value={body}
          maxLength={LIMITS.noteBodyMax}
          disabled={disabled || pending || (!note && operation.locked)}
          className="min-h-36"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'note-body-hint note-save-error' : 'note-body-hint'}
          onChange={(e) => {
            setBody(e.target.value);
            setError(null);
          }}
        />
      </Field>
      {error ? (
        <p id="note-save-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {operation.conflict ? (
        <Button
          variant="secondary"
          disabled={pending}
          className="h-auto min-h-11 w-full whitespace-normal"
          onClick={() => {
            void onRefresh()
              .then(() => {
                operation.restart();
                setError(null);
              })
              .catch((e: unknown) => setError(workflowError(e)));
          }}
        >
          Aggiorna dati e prepara nuova richiesta
        </Button>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => (dirty ? setDiscard(true) : onClose())}
        >
          Annulla
        </Button>
        <Button
          type="submit"
          disabled={disabled || pending || operation.conflict || (note !== null && !dirty)}
        >
          {pending
            ? 'Salvataggio…'
            : operation.locked
              ? 'Riprova la stessa richiesta'
              : 'Salva nota'}
        </Button>
      </div>
      <ConfirmDialog
        open={discard}
        onOpenChange={setDiscard}
        title="Abbandonare la nota?"
        description={
          <p>
            La bozza non salvata andrà persa. Se la risposta non è arrivata, la nota potrebbe essere
            già registrata: aggiorna l’elenco prima di crearne un’altra.
          </p>
        }
        confirmLabel="Abbandona bozza"
        onConfirm={onClose}
      />
    </form>
  );
}
