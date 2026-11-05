import type { ColorToken, Label } from '@meet-roulette/schemas';
import { LIMITS } from '@meet-roulette/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { Skeleton } from '@/components/ui/skeleton';
import { ColorPicker } from '@/features/boards/color-picker';
import { userMessage } from '@/features/kanban/mutations';
import { useCreateLabel, useDeleteLabel, useLabels, useUpdateLabel } from './api';
import { LabelChip } from './label-chip';

/** Gestione completa delle etichette del workspace (Impostazioni). */
export function LabelsManager() {
  const labels = useLabels();
  const create = useCreateLabel();
  const [name, setName] = useState('');
  const [color, setColor] = useState<ColorToken>('slate');
  const [error, setError] = useState<string | null>(null);
  const notify = useNotify();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Scrivi il nome dell’etichetta');
      return;
    }
    setError(null);
    create.mutate(
      { name: name.trim(), color },
      {
        onSuccess: ({ label }) => {
          setName('');
          notify('success', `Etichetta “${label.name}” creata.`);
        },
        onError: (e) => setError(userMessage(e, 'Non siamo riusciti a creare l’etichetta.')),
      },
    );
  };

  return (
    <div className="space-y-5">
      <form onSubmit={submit} noValidate className="space-y-3">
        <Field id="new-label-name" label="Nuova etichetta" error={error ?? undefined}>
          <div className="flex gap-2">
            <Input
              id="new-label-name"
              value={name}
              maxLength={LIMITS.labelNameMax}
              placeholder="Es. Estero, Part-time, Da approfondire"
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'new-label-name-error' : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
            <Button type="submit" disabled={create.isPending}>
              <Plus aria-hidden="true" />
              Crea
            </Button>
          </div>
        </Field>
        <ColorPicker
          name="new-label-color"
          value={color}
          allowNone={false}
          onChange={(v) => setColor(v ?? 'slate')}
        />
      </form>

      {labels.isPending ? (
        <div role="status" aria-label="Caricamento delle etichette" className="space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : labels.isError ? (
        <p role="alert" className="text-sm text-danger">
          Non riusciamo a caricare le etichette.{' '}
          <button type="button" className="underline" onClick={() => void labels.refetch()}>
            Riprova
          </button>
        </p>
      ) : labels.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessuna etichetta. Servono a ritrovare le opportunità: “Estero”, “Part-time”, “Da
          ricontattare”…
        </p>
      ) : (
        <ul
          aria-label="Etichette"
          className="divide-y divide-border rounded-md border border-border"
        >
          {labels.data.map((label) => (
            <LabelRow key={label.id} label={label} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LabelRow({ label }: { label: Label }) {
  const update = useUpdateLabel();
  const remove = useDeleteLabel();
  const notify = useNotify();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState<ColorToken>(label.color);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Scrivi il nome dell’etichetta');
      return;
    }
    update.mutate(
      { labelId: label.id, input: { name: name.trim(), color } },
      {
        onSuccess: () => {
          setEditing(false);
          setError(null);
          notify('success', 'Etichetta aggiornata.');
        },
        onError: (e) => setError(userMessage(e, 'Non siamo riusciti a salvare.')),
      },
    );
  };

  const used = label.cardCount;
  return (
    <li className="p-3">
      {editing ? (
        <form onSubmit={save} noValidate className="space-y-3">
          <Field id={`label-${label.id}-name`} label="Nome" error={error ?? undefined}>
            <Input
              id={`label-${label.id}-name`}
              value={name}
              maxLength={LIMITS.labelNameMax}
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `label-${label.id}-name-error` : undefined}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <ColorPicker
            name={`label-${label.id}-color`}
            value={color}
            allowNone={false}
            onChange={(v) => setColor(v ?? 'slate')}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? 'Salvataggio…' : 'Salva'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditing(false);
                setName(label.name);
                setColor(label.color);
                setError(null);
              }}
            >
              Annulla
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <LabelChip name={label.name} color={label.color} />
          <span className="text-xs text-muted-foreground">
            {used === 0 ? 'Non in uso' : used === 1 ? '1 scheda' : `${used} schede`}
          </span>
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" />
              <span className="sr-only">Modifica l’etichetta {label.name}</span>
              <span aria-hidden="true">Modifica</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(true)}>
              <Trash2 aria-hidden="true" />
              <span className="sr-only">Elimina l’etichetta {label.name}</span>
              <span aria-hidden="true">Elimina</span>
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={deleting}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(false);
            remove.reset();
          }
        }}
        title={`Eliminare “${label.name}”?`}
        description={
          used > 0 ? (
            <>
              <p>
                L’etichetta è assegnata a {used} {used === 1 ? 'scheda' : 'schede'}: verrà tolta
                {used === 1 ? ' da quella scheda' : ' da tutte'}.
              </p>
              <p className="font-medium text-foreground">Le schede non vengono eliminate.</p>
            </>
          ) : (
            <p>L’etichetta non è usata da nessuna scheda.</p>
          )
        }
        confirmLabel="Elimina etichetta"
        pending={remove.isPending}
        error={
          remove.error ? userMessage(remove.error, 'Qualcosa è andato storto. Riprova.') : null
        }
        onConfirm={() =>
          remove.mutate(
            { labelId: label.id, force: used > 0 },
            {
              onSuccess: () => {
                setDeleting(false);
                notify('success', `Etichetta “${label.name}” eliminata.`);
              },
            },
          )
        }
      />
    </li>
  );
}
