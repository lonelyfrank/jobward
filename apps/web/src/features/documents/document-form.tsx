import {
  createDocumentInput,
  updateDocumentInput,
  type CardDocument,
  type CreateDocumentInput,
  type UpdateDocumentInput,
} from '@jobward/schemas';
import { DOCUMENT_KINDS, LIMITS, type DocumentKind } from '@jobward/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreationOperation } from '@/features/cards/creation-operation';
import { useDirtyReporter } from '@/features/cards/dirty-guard';
import { workflowError } from '@/features/cards/workflow-feedback';

export const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  cv: 'CV',
  cover_letter: 'Lettera di presentazione',
  job_posting: 'Annuncio di lavoro',
  portfolio: 'Portfolio',
  other: 'Altro',
};
export function DocumentForm({
  document: existing,
  disabled,
  onCreate,
  onUpdate,
  onRefresh,
  onClose,
}: {
  document: CardDocument | null;
  disabled: boolean;
  onCreate: (input: CreateDocumentInput) => Promise<unknown>;
  onUpdate: (input: UpdateDocumentInput) => Promise<unknown>;
  onRefresh: () => Promise<unknown>;
  onClose: () => void;
}) {
  const initial = {
    title: existing?.title ?? '',
    kind: existing?.kind ?? 'other',
    url: existing?.url ?? '',
    note: existing?.note ?? '',
  };
  const [draft, setDraft] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);
  const operation = useCreationOperation<CreateDocumentInput>();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || operation.locked || pending;
  useDirtyReporter('document-editor', dirty);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const set = (key: keyof typeof draft, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const values = { ...draft, url: draft.url.trim() || null, note: draft.note.trim() || null };
    // PATCH differenziale: una modifica al titolo non sovrascrive l'URL modificato altrove.
    const changes = Object.fromEntries(
      Object.entries(values).filter(
        ([key]) => draft[key as keyof typeof draft] !== initial[key as keyof typeof draft],
      ),
    );
    const parsed = existing
      ? updateDocumentInput.safeParse(changes)
      : createDocumentInput.safeParse({ ...values, id: operation.id });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(' · '));
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (existing) await onUpdate(parsed.data);
      else await onCreate(operation.capture(parsed.data as CreateDocumentInput));
      onClose();
    } catch (e) {
      if (!existing) operation.failed(e);
      setError(workflowError(e));
    } finally {
      setPending(false);
    }
  };
  const locked = disabled || pending || (!existing && operation.locked);
  return (
    <form
      aria-label={existing ? 'Modifica riferimento' : 'Nuovo riferimento'}
      onSubmit={(e) => void submit(e)}
      noValidate
      className="space-y-3 rounded-lg border border-border-strong p-4"
    >
      <fieldset disabled={locked} className="space-y-3">
        <legend className="sr-only">Dati del riferimento</legend>
        <Field id="document-title" label="Titolo del documento">
          <Input
            ref={input}
            id="document-title"
            value={draft.title}
            maxLength={LIMITS.titleMax}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
        <Field id="document-kind" label="Tipo di documento">
          <Select
            id="document-kind"
            value={draft.kind}
            onChange={(e) => set('kind', e.target.value)}
          >
            {DOCUMENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {DOCUMENT_LABELS[kind]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id="document-url"
          label="URL (facoltativo)"
          hint="Solo collegamenti http o https. Non viene caricato alcun file."
        >
          <Input
            id="document-url"
            type="url"
            value={draft.url}
            maxLength={LIMITS.urlMax}
            onChange={(e) => set('url', e.target.value)}
          />
        </Field>
        <Field id="document-note" label="Nota sul documento (facoltativa)">
          <Textarea
            id="document-note"
            value={draft.note}
            maxLength={LIMITS.documentNoteMax}
            onChange={(e) => set('note', e.target.value)}
          />
        </Field>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-danger">
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
          disabled={disabled || pending || operation.conflict || (!!existing && !dirty)}
        >
          {pending
            ? 'Salvataggio…'
            : operation.locked
              ? 'Riprova la stessa richiesta'
              : 'Salva riferimento'}
        </Button>
      </div>
      <ConfirmDialog
        open={discard}
        onOpenChange={setDiscard}
        title="Abbandonare il riferimento?"
        description={
          <p>
            La bozza non salvata andrà persa. Se la risposta non è arrivata, il riferimento potrebbe
            essere già registrato: aggiorna l’elenco prima di crearne un altro.
          </p>
        }
        confirmLabel="Abbandona bozza"
        onConfirm={onClose}
      />
    </form>
  );
}
