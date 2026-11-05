import { type ThemePreference } from '@jobward/shared';
import { lazy, Suspense } from 'react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Surface } from '@/components/ui/surface';
import { useWorkspace } from '@/features/workspace/context';
import { useTheme } from '@/lib/theme';

const LabelsManager = lazy(() =>
  import('@/features/labels/labels-manager').then((m) => ({ default: m.LabelsManager })),
);

const THEME_OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'light', label: 'Chiaro', hint: 'Sfondo chiaro in ogni condizione.' },
  { value: 'dark', label: 'Scuro', hint: 'Sfondo scuro, più riposante di sera.' },
  { value: 'system', label: 'Come il sistema', hint: 'Segue la preferenza del dispositivo.' },
];

const UPCOMING = [
  { label: 'Esportazione dei tuoi dati', milestone: 'M4' },
  { label: 'Eliminazione dell’account e dei dati', milestone: 'M5' },
];

export function SettingsPage() {
  const { user, workspace } = useWorkspace();
  const { preference, setPreference } = useTheme();

  return (
    <>
      <PageHeader
        title="Impostazioni"
        description="Preferenze dell’interfaccia e informazioni sul tuo spazio."
      />

      <div className="max-w-2xl space-y-6">
        <Surface className="p-5">
          <h2 className="text-[17px] font-bold">Etichette</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Parole chiave tue per ritrovare le opportunità, valide in tutte le bacheche. I campi
            personalizzati si configurano per bacheca, dal menu “Azioni bacheca”.
          </p>
          <Suspense
            fallback={
              <p role="status" className="text-sm text-muted-foreground">
                Caricamento…
              </p>
            }
          >
            <LabelsManager />
          </Suspense>
        </Surface>

        <Surface className="p-5">
          <fieldset>
            <legend className="font-semibold">Aspetto</legend>
            <p className="mt-1 text-sm text-muted-foreground">
              La scelta viene ricordata su questo dispositivo.
            </p>
            <div className="mt-4 space-y-1">
              {THEME_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  htmlFor={`theme-${option.value}`}
                  className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-surface-muted max-md:py-3"
                >
                  <input
                    id={`theme-${option.value}`}
                    type="radio"
                    name="theme"
                    value={option.value}
                    checked={preference === option.value}
                    onChange={() => setPreference(option.value)}
                    className="mt-1 size-4 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </Surface>

        <Surface className="p-5">
          <h2 className="text-[17px] font-bold">Workspace</h2>
          <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Nome</dt>
            <dd>{workspace.name}</dd>
            <dt className="text-muted-foreground">Fuso orario</dt>
            <dd>{workspace.timezone}</dd>
            <dt className="text-muted-foreground">Ruolo</dt>
            <dd>{workspace.role === 'owner' ? 'Proprietario' : workspace.role}</dd>
          </dl>
        </Surface>

        <Surface className="p-5">
          <h2 className="text-[17px] font-bold">Account</h2>
          <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="break-all">{user.email}</dd>
          </dl>
        </Surface>

        <Surface className="p-5">
          <h2 className="text-[17px] font-bold">In arrivo</h2>
          <ul className="mt-3 space-y-2">
            {UPCOMING.map((item) => (
              <li key={item.label} className="flex flex-wrap items-center gap-2 text-sm">
                <span>{item.label}</span>
                <Badge tone="warning">{item.milestone}</Badge>
              </li>
            ))}
          </ul>
        </Surface>
      </div>
    </>
  );
}
