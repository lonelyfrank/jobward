import { meResponse, workspaceResponse } from '@jobward/schemas';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Surface } from '@/components/ui/surface';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  readDataProfile,
  restartApp,
  writeDataProfile,
  type DataProfile,
} from '@/lib/data-profile';
import { useMe } from './api';

const OPTIONS: { value: DataProfile; label: string }[] = [
  { value: 'real', label: 'I miei dati' },
  { value: 'demo', label: 'Dati demo' },
];

const regenerate = () => apiRequest('/demo/reset', workspaceResponse, { method: 'POST', json: {} });

/**
 * Selettore fra i dati reali e un insieme dimostrativo (solo sviluppo locale: il server lo dichiara
 * in `/me`). Il profilo demo è un'identità separata, quindi passare da uno all'altro non copia, non
 * sposta e non cancella nulla dei dati reali; «Rigenera» agisce soltanto sui dati demo.
 */
export function DataProfileSettings() {
  const me = useMe();
  const [pending, setPending] = useState<'switch' | 'reset' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!me.data?.profile.available) return null;
  const active = me.data.profile.active;

  async function switchTo(next: DataProfile) {
    if (next === active || pending) return;
    const previous = readDataProfile();
    setPending('switch');
    setError(null);
    if (!writeDataProfile(next)) {
      setPending(null);
      setError('Il browser non permette di salvare la scelta (archiviazione locale bloccata).');
      return;
    }
    try {
      // Al primo passaggio il profilo demo è vuoto: lo si popola prima di ricaricare.
      if (next === 'demo') {
        const demo = await apiRequest('/me', meResponse);
        if (demo.workspaces.length === 0) await regenerate();
      }
      restartApp();
    } catch {
      writeDataProfile(previous);
      setPending(null);
      setError('Non è stato possibile preparare i dati demo. Riprova.');
    }
  }

  async function reset() {
    setPending('reset');
    setError(null);
    try {
      await regenerate();
      restartApp();
    } catch {
      setPending(null);
      setError('Non è stato possibile rigenerare i dati demo. Riprova.');
    }
  }

  return (
    <Surface className="p-5">
      <h2 className="text-[17px] font-bold">Dati demo</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Mostra Jobward con un insieme di candidature di esempio, utile per farlo vedere a qualcuno.
        I tuoi dati restano separati e intatti: nulla viene copiato, spostato o cancellato.
        Disponibile solo in sviluppo locale.
      </p>
      <SegmentedControl label="Dati mostrati" value={active}>
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={active === option.value}
            disabled={pending !== null}
            onClick={() => void switchTo(option.value)}
            className={cn(
              'relative z-10 inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold transition-colors disabled:cursor-wait max-md:min-h-11',
              active === option.value
                ? 'text-primary-soft-foreground'
                : 'text-muted-foreground hover:bg-surface hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </SegmentedControl>
      {pending === 'switch' ? (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          Preparazione dei dati…
        </p>
      ) : null}
      {active === 'demo' ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            disabled={pending !== null}
            onClick={() => setConfirming(true)}
          >
            <RefreshCw aria-hidden="true" /> Rigenera dati demo
          </Button>
          <span className="text-xs text-muted-foreground">
            Riporta la demo allo stato iniziale, con date aggiornate a oggi.
          </span>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Rigenerare i dati demo?"
        description="Le modifiche fatte nella demo vengono cancellate e sostituite da un nuovo insieme di esempio. I tuoi dati reali non vengono toccati."
        confirmLabel="Rigenera"
        pending={pending === 'reset'}
        onConfirm={() => void reset()}
      />
    </Surface>
  );
}
