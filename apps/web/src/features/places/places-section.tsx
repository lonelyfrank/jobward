import type { Place } from '@jobward/schemas';
import { formatCoordinates, LIMITS, parseCoordinates, type PlaceKind } from '@jobward/shared';
import { House, MapPin, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { Skeleton } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';
import { ApiRequestError } from '@/lib/api';
import { usePlaceMutations, usePlaces } from './api';
import { COORDINATES_HINT } from './coordinates';

export const PLACE_KIND_LABELS: Record<PlaceKind, string> = {
  home: 'Casa',
  other: 'Altra posizione',
};

interface Draft {
  name: string;
  kind: PlaceKind;
  coordinates: string;
}

const EMPTY: Draft = { name: '', kind: 'home', coordinates: '' };

/**
 * Posizioni personali (D-07): casa e altre posizioni catalogate, riferimenti per le distanze
 * della vista Mappa. Appartengono al profilo: il profilo demo ha le sue.
 */
export function PlacesSection() {
  const places = usePlaces();
  const { create, update, remove } = usePlaceMutations();
  const notify = useNotify();
  /** `null` = nessun modulo aperto; `'new'` = aggiunta; altrimenti l'id della posizione in modifica. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [deleting, setDeleting] = useState<Place | null>(null);

  const list = places.data ?? [];
  const hasHome = list.some((p) => p.kind === 'home');
  const parsed = parseCoordinates(draft.coordinates);
  const saving = create.isPending || update.isPending;

  const open = (place: Place | null) => {
    setErrors({});
    if (place) {
      setEditing(place.id);
      setDraft({ name: place.name, kind: place.kind, coordinates: formatCoordinates(place) });
    } else {
      setEditing('new');
      setDraft({ ...EMPTY, kind: hasHome ? 'other' : 'home' });
    }
  };
  const close = () => {
    setEditing(null);
    setErrors({});
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    const name = draft.name.trim();
    if (!name) next.name = 'Dai un nome alla posizione';
    if (!parsed) {
      next.coordinates = draft.coordinates.trim()
        ? 'Non riconosciamo delle coordinate valide in questo testo'
        : 'Indica le coordinate della posizione';
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed) return;
    const input = { name, kind: draft.kind, ...parsed };
    try {
      if (editing === 'new') await create.mutateAsync(input);
      else if (editing) await update.mutateAsync({ id: editing, input });
      notify('success', editing === 'new' ? 'Posizione aggiunta' : 'Posizione aggiornata');
      close();
    } catch (error) {
      const message = error instanceof ApiRequestError ? error.message : 'Salvataggio non riuscito';
      setErrors(error instanceof ApiRequestError && error.status === 409 ? { name: message } : {});
      notify('error', message);
    }
  };

  const form = (
    <form
      onSubmit={(e) => void submit(e)}
      aria-label={editing === 'new' ? 'Nuova posizione' : 'Modifica posizione'}
      className="space-y-4 rounded-lg border border-border p-4"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="place-name" label="Nome" error={errors.name}>
          <Input
            id="place-name"
            value={draft.name}
            maxLength={LIMITS.placeNameMax}
            autoComplete="off"
            placeholder="Casa, Torino, Lisbona…"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'place-name-error' : undefined}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field
          id="place-kind"
          label="Tipo"
          hint={
            draft.kind === 'home' && hasHome && list.find((p) => p.id === editing)?.kind !== 'home'
              ? 'La casa attuale diventerà «Altra posizione».'
              : undefined
          }
        >
          <Select
            id="place-kind"
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value as PlaceKind })}
          >
            {(Object.keys(PLACE_KIND_LABELS) as PlaceKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {PLACE_KIND_LABELS[kind]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field
        id="place-coordinates"
        label="Coordinate"
        hint={COORDINATES_HINT}
        error={errors.coordinates}
      >
        <Input
          id="place-coordinates"
          value={draft.coordinates}
          maxLength={LIMITS.urlMax}
          autoComplete="off"
          inputMode="decimal"
          placeholder="45.4642, 9.19"
          aria-invalid={errors.coordinates ? true : undefined}
          aria-describedby={
            errors.coordinates ? 'place-coordinates-error' : 'place-coordinates-hint'
          }
          onChange={(e) => setDraft({ ...draft, coordinates: e.target.value })}
        />
      </Field>
      {parsed && draft.coordinates.trim() !== formatCoordinates(parsed) ? (
        <p className="-mt-2 text-xs text-muted-foreground" aria-live="polite">
          Coordinate lette: {formatCoordinates(parsed)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Salvataggio…' : 'Salva posizione'}
        </Button>
        <Button variant="secondary" size="sm" onClick={close} disabled={saving}>
          Annulla
        </Button>
      </div>
    </form>
  );

  return (
    <Surface className="p-6" role="region" aria-labelledby="places-title">
      <h2 id="places-title" className="text-[17px] font-bold">
        Le tue posizioni
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Casa e altre posizioni da cui misurare, in linea d’aria, la distanza delle opportunità nella
        vista Mappa. Restano nel tuo profilo.
      </p>

      <div className="mt-4 space-y-3">
        {places.isPending ? (
          <Skeleton className="h-14" />
        ) : places.isError ? (
          <p role="alert" className="text-sm text-danger">
            Non riusciamo a caricare le posizioni.{' '}
            <button type="button" className="underline" onClick={() => void places.refetch()}>
              Riprova
            </button>
          </p>
        ) : list.length === 0 && editing !== 'new' ? (
          <p className="text-sm text-muted-foreground">
            Nessuna posizione: aggiungi casa per vedere quanto distano le opportunità.
          </p>
        ) : (
          <ul className="space-y-2" aria-label="Posizioni salvate">
            {list.map((place) =>
              editing === place.id ? (
                <li key={place.id}>{form}</li>
              ) : (
                <li
                  key={place.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  {place.kind === 'home' ? (
                    <House aria-hidden="true" className="size-5 shrink-0 text-primary" />
                  ) : (
                    <MapPin aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">
                      {place.name}
                      {place.kind === 'home' ? (
                        <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-soft-foreground">
                          Casa
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatCoordinates(place)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={editing !== null}
                      onClick={() => open(place)}
                      aria-label={`Modifica ${place.name}`}
                    >
                      Modifica
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={editing !== null}
                      onClick={() => setDeleting(place)}
                      aria-label={`Elimina ${place.name}`}
                    >
                      Elimina
                    </Button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
        {editing === 'new' ? form : null}
        {editing === null && list.length < LIMITS.placesPerUserMax && !places.isPending ? (
          <Button variant="secondary" size="sm" onClick={() => open(null)}>
            <Plus aria-hidden="true" />
            Aggiungi una posizione
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title="Eliminare la posizione?"
        description={
          <p>
            «{deleting?.name}» non sarà più un riferimento per le distanze. Le opportunità non
            cambiano.
          </p>
        }
        confirmLabel="Elimina"
        pending={remove.isPending}
        error={remove.error ? remove.error.message : null}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null);
              notify('success', 'Posizione eliminata');
            },
          });
        }}
      />
    </Surface>
  );
}
