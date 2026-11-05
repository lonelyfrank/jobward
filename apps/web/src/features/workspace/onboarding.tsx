import { zodResolver } from '@hookform/resolvers/zod';
import { createWorkspaceInput, timezoneSchema } from '@meet-roulette/schemas';
import { Columns3, LayoutGrid, StickyNote } from 'lucide-react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { LogoMark } from '@/components/brand/logo';
import { BRAND } from '@/lib/brand';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Surface } from '@/components/ui/surface';
import { ApiRequestError } from '@/lib/api';
import { useCreateWorkspace } from './api';

const formSchema = createWorkspaceInput.extend({ timezone: timezoneSchema });
type FormValues = z.infer<typeof formSchema>;

function listTimezones(): string[] {
  const zones = Intl.supportedValuesOf('timeZone');
  return zones.includes('UTC') ? zones : ['UTC', ...zones];
}

const concepts = [
  {
    icon: LayoutGrid,
    title: 'Bacheche',
    text: 'Una bacheca raccoglie le opportunità di una ricerca.',
  },
  {
    icon: Columns3,
    title: 'Colonne',
    text: 'Le colonne sono le tue fasi: le scegli e le ordini tu.',
  },
  {
    icon: StickyNote,
    title: 'Schede',
    text: 'Ogni opportunità è una scheda: basta il titolo per iniziare.',
  },
];

/** Primo accesso: crea il workspace. È l'unico passo realmente disponibile in M0. */
export function Onboarding() {
  const create = useCreateWorkspace();
  const timezones = useMemo(() => listTimezones(), []);
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: 'La mia ricerca',
      timezone: timezones.includes(detected) ? detected : 'UTC',
    },
  });

  const serverError =
    create.error instanceof ApiRequestError
      ? create.error.message
      : create.error
        ? 'Qualcosa è andato storto. Riprova.'
        : null;

  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex items-center gap-3">
          <LogoMark className="size-9" />
          <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
        </div>

        <Surface className="p-6 sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">Crea il tuo spazio di lavoro</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Qui organizzerai la tua ricerca del lavoro. I dati restano privati e collegati al tuo
            account.
          </p>

          <form
            noValidate
            className="mt-6 space-y-4"
            onSubmit={(event) => void handleSubmit((values) => create.mutate(values))(event)}
          >
            <Field id="workspace-name" label="Nome dello spazio" error={errors.name?.message}>
              <Input
                id="workspace-name"
                autoComplete="off"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? 'workspace-name-error' : undefined}
                {...register('name')}
              />
            </Field>

            <Field
              id="workspace-timezone"
              label="Fuso orario"
              hint="Serve a mostrare scadenze e promemoria all'ora giusta."
              error={errors.timezone?.message}
            >
              <Select
                id="workspace-timezone"
                aria-describedby="workspace-timezone-hint"
                {...register('timezone')}
              >
                {timezones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </Select>
            </Field>

            {serverError ? (
              <p
                role="alert"
                className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
              >
                {serverError}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={create.isPending}>
              {create.isPending ? 'Creazione in corso…' : 'Crea workspace'}
            </Button>
          </form>
        </Surface>

        <ul className="mt-6 grid gap-3 sm:grid-cols-3" aria-label={`Come funziona ${BRAND.name}`}>
          {concepts.map(({ icon: Icon, title, text }) => (
            <li key={title} className="text-sm">
              <Icon aria-hidden="true" className="mb-1.5 size-4 text-primary" />
              <p className="font-medium">{title}</p>
              <p className="text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
