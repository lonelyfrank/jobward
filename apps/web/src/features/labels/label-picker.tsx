import type { ColorToken } from '@jobward/schemas';
import { LIMITS } from '@jobward/shared';
import { Plus, X } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { ColorPicker } from '@/features/boards/color-picker';
import { userMessage } from '@/features/kanban/mutations';
import { useCreateLabel, useLabels } from './api';
import { LabelChip } from './label-chip';

/**
 * Etichette di una scheda, controllate dal modulo della modale: assegnare e togliere cambiano solo
 * la bozza, che si salva con il «Salva» unico insieme al resto. Creare un'etichetta nuova è invece
 * immediato (nasce nell'elenco del workspace) e la si aggiunge subito alla bozza. Rinomina, colore
 * ed eliminazione stanno in Impostazioni.
 */
export function LabelPicker({
  cardId,
  labelIds,
  disabled,
  onChange,
}: {
  cardId: string;
  labelIds: string[];
  disabled: boolean;
  onChange: (labelIds: string[]) => void;
}) {
  const notify = useNotify();
  const labels = useLabels();
  const create = useCreateLabel();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<ColorToken>('slate');
  const [error, setError] = useState<string | null>(null);
  const panelId = useId();
  const nameId = useId();

  const all = labels.data ?? [];
  const assigned = all.filter((l) => labelIds.includes(l.id));

  const toggle = (labelId: string, on: boolean) =>
    onChange(on ? [...labelIds, labelId] : labelIds.filter((id) => id !== labelId));

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Scrivi il nome dell’etichetta');
      return;
    }
    setError(null);
    create.mutate(
      { name: trimmed, color },
      {
        onSuccess: ({ label }) => {
          setName('');
          notify('success', `Etichetta “${label.name}” creata: salva per assegnarla.`);
          onChange([...labelIds, label.id]);
        },
        onError: (e) => setError(userMessage(e, 'Non siamo riusciti a creare l’etichetta.')),
      },
    );
  };

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="sr-only">Etichette</legend>
      <div className="flex flex-wrap items-center gap-1.5">
        <ul aria-label="Etichette assegnate" className="flex flex-wrap items-center gap-1.5">
          {assigned.length === 0 ? (
            <li className="text-xs text-muted-foreground">Nessuna etichetta.</li>
          ) : (
            assigned.map((l) => (
              <li key={l.id}>
                <LabelChip name={l.name} color={l.color}>
                  <button
                    type="button"
                    aria-label={`Rimuovi l’etichetta ${l.name}`}
                    disabled={disabled}
                    onClick={() => toggle(l.id, false)}
                    className="-mr-1 grid size-5 place-items-center rounded-full hover:bg-surface-muted max-md:size-11"
                  >
                    <X aria-hidden="true" className="size-3" />
                  </button>
                </LabelChip>
              </li>
            ))
          )}
        </ul>
        {!disabled ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed border-border-strong px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary-soft-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-md:h-11"
          >
            {open ? (
              <X aria-hidden="true" className="size-3" />
            ) : (
              <Plus aria-hidden="true" className="size-3" />
            )}
            {open ? (
              <>
                Chiudi <span className="sr-only">etichette</span>
              </>
            ) : (
              <>
                <span className="sr-only">Aggiungi</span> Etichetta
              </>
            )}
          </button>
        ) : null}
      </div>

      <div id={panelId} hidden={!open} className="space-y-3 rounded-md border border-border p-3">
        {labels.isError ? (
          <p role="alert" className="text-sm text-danger">
            Non riusciamo a caricare le etichette.{' '}
            <button type="button" className="underline" onClick={() => void labels.refetch()}>
              Riprova
            </button>
          </p>
        ) : all.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Non hai ancora etichette: creane una qui sotto.
          </p>
        ) : (
          <ul aria-label="Etichette disponibili" className="space-y-1">
            {all.map((l) => (
              <li key={l.id}>
                <label className="row-hover -mx-2.5 flex min-h-9 cursor-pointer items-center gap-2.5 px-2.5 max-md:min-h-11">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={labelIds.includes(l.id)}
                    disabled={disabled}
                    onChange={(e) => toggle(l.id, e.target.checked)}
                  />
                  <LabelChip name={l.name} color={l.color} />
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2 border-t border-border pt-3">
          <label htmlFor={nameId} className="block text-sm font-medium">
            Nuova etichetta
          </label>
          <Input
            id={nameId}
            value={name}
            maxLength={LIMITS.labelNameMax}
            placeholder="Es. Da ricontattare"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${nameId}-error` : undefined}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              // Invio crea l'etichetta, non salva il modulo di dettaglio.
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
          />
          <ColorPicker
            name={`label-color-${cardId}`}
            value={color}
            allowNone={false}
            onChange={(v) => setColor(v ?? 'slate')}
          />
          {error ? (
            <p id={`${nameId}-error`} role="alert" className="text-xs font-medium text-danger">
              {error}
            </p>
          ) : null}
          <Button size="sm" onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'Creazione…' : 'Crea e assegna'}
          </Button>
        </div>
      </div>
    </fieldset>
  );
}
