import { zodResolver } from '@hookform/resolvers/zod';
import {
  colorToken,
  createBoardInput,
  updateBoardInput,
  type Board,
  type ColorToken,
} from '@meet-roulette/schemas';
import {
  BOARD_TEMPLATE_IDS,
  BOARD_TEMPLATES,
  LIMITS,
  type BoardTemplateId,
} from '@meet-roulette/shared';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useCreateBoard, useUpdateBoard } from './api';
import { ColorPicker } from './color-picker';

const formSchema = z.object({
  name: createBoardInput.shape.name,
  description: z.string().trim().max(LIMITS.shortTextMax),
  color: colorToken.nullable(),
  templateId: z.enum(BOARD_TEMPLATE_IDS),
});
type FormValues = z.infer<typeof formSchema>;

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiRequestError ? error.message : 'Qualcosa è andato storto. Riprova.';
}

/** Creazione (con scelta del template) e modifica (nome, descrizione, colore) di una bacheca. */
export function BoardDialog({
  open,
  onOpenChange,
  board,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se presente il dialogo modifica questa bacheca; altrimenti ne crea una nuova. */
  board?: Board;
  onCreated?: (boardId: string) => void;
}) {
  const editing = board !== undefined;
  const create = useCreateBoard();
  const update = useUpdateBoard();
  const pending = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: board?.name ?? '',
      description: board?.description ?? '',
      color: (board?.color as ColorToken | null | undefined) ?? null,
      templateId: 'job-search-standard' satisfies BoardTemplateId,
    },
  });
  const selectedTemplate = useWatch({ control, name: 'templateId' });
  const serverError = errorMessage(create.error ?? update.error);

  const submit = handleSubmit((values) => {
    const description = values.description === '' ? null : values.description;
    if (editing) {
      const input = updateBoardInput.parse({
        name: values.name,
        description,
        color: values.color,
      });
      update.mutate({ boardId: board.id, input }, { onSuccess: () => onOpenChange(false) });
    } else {
      create.mutate(
        { name: values.name, description, color: values.color, templateId: values.templateId },
        {
          onSuccess: ({ board: created }) => {
            onOpenChange(false);
            onCreated?.(created.id);
          },
        },
      );
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Modifica bacheca' : 'Nuova bacheca'}
      description={
        editing
          ? 'Cambia nome, descrizione e colore. Le colonne si modificano dentro la bacheca.'
          : 'Scegli da dove partire: potrai cambiare colonne e nomi quando vuoi.'
      }
    >
      <form noValidate onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-col">
        <DialogBody className="space-y-4">
          <Field id="board-name" label="Nome" error={errors.name?.message}>
            <Input
              id="board-name"
              autoComplete="off"
              maxLength={LIMITS.nameMax}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'board-name-error' : undefined}
              {...register('name')}
            />
          </Field>

          <Field
            id="board-description"
            label="Descrizione (facoltativa)"
            error={errors.description?.message}
          >
            <Textarea
              id="board-description"
              className="min-h-16"
              maxLength={LIMITS.shortTextMax}
              {...register('description')}
            />
          </Field>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Colore</p>
            <Controller
              control={control}
              name="color"
              render={({ field }) => (
                <ColorPicker name="board-color" value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          {!editing ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Template</legend>
              <div className="grid gap-2">
                {BOARD_TEMPLATES.map((template) => (
                  <label key={template.id} className="relative block">
                    <input
                      type="radio"
                      value={template.id}
                      className="peer sr-only"
                      {...register('templateId')}
                    />
                    <span
                      className={cn(
                        'block rounded-lg border border-border-strong p-3 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring',
                        selectedTemplate === template.id &&
                          'border-primary bg-primary-soft ring-1 ring-primary',
                      )}
                    >
                      <span className="block text-sm font-medium">{template.name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {template.description}
                      </span>
                      {template.columns.length > 0 ? (
                        <span className="mt-2 flex flex-wrap gap-1">
                          {template.columns.map((column) => (
                            <Badge key={column.name}>{column.name}</Badge>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {serverError ? (
            <p
              role="alert"
              className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
            >
              {serverError}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Annulla
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Salvataggio…' : editing ? 'Salva' : 'Crea bacheca'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
