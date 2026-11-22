import { zodResolver } from '@hookform/resolvers/zod';
import { createColumnInput, type Column } from '@jobward/schemas';
import { LIMITS, STAGES } from '@jobward/shared';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { useCreateColumn, useUpdateColumn } from '@/features/boards/api';
import { ColorPicker } from '@/features/boards/color-picker';
import { ApiRequestError } from '@/lib/api';
import { STAGE_LABELS } from '@/lib/labels';

type FormValues = z.input<typeof createColumnInput>;

/** Creazione e modifica di una colonna: nome, colore e fase semantica (facoltativa). */
export function ColumnDialog({
  boardId,
  column,
  open,
  onOpenChange,
}: {
  boardId: string;
  column?: Column;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const editing = column !== undefined;
  const create = useCreateColumn(boardId);
  const update = useUpdateColumn(boardId);
  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createColumnInput),
    defaultValues: {
      name: column?.name ?? '',
      color: (column?.color as FormValues['color']) ?? null,
      category: column?.category ?? null,
    },
  });

  const submit = handleSubmit((values) => {
    const done = { onSuccess: () => onOpenChange(false) };
    if (editing) {
      update.mutate(
        {
          columnId: column.id,
          input: {
            name: values.name,
            color: values.color ?? null,
            category: values.category ?? null,
          },
        },
        done,
      );
    } else {
      create.mutate(
        { name: values.name, color: values.color ?? null, category: values.category ?? null },
        done,
      );
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Modifica colonna' : 'Nuova colonna'}
      description="Le colonne sono le fasi del tuo percorso: scegli nomi e ordine come preferisci."
    >
      <form noValidate onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-col">
        <DialogBody className="space-y-4">
          <Field id="column-name" label="Nome" error={errors.name?.message}>
            <Input
              id="column-name"
              autoComplete="off"
              maxLength={LIMITS.nameMax}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'column-name-error' : undefined}
              {...register('name')}
            />
          </Field>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Colore</p>
            <Controller
              control={control}
              name="color"
              render={({ field }) => (
                <ColorPicker
                  name="column-color"
                  value={field.value ?? null}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <Field
            id="column-category"
            label="Fase del percorso (facoltativa)"
            hint="Serve a riconoscere il significato della colonna. Spostare una scheda qui non modifica i suoi dati."
          >
            <Select
              id="column-category"
              aria-describedby="column-category-hint"
              {...register('category', { setValueAs: (v: string) => (v === '' ? null : v) })}
            >
              <option value="">Nessuna</option>
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </option>
              ))}
            </Select>
          </Field>

          {error ? (
            <p
              role="alert"
              className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
            >
              {error instanceof ApiRequestError
                ? error.message
                : 'Qualcosa è andato storto. Riprova.'}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Annulla
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Salvataggio…' : editing ? 'Salva' : 'Aggiungi colonna'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
