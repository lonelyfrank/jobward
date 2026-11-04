import { Lock, RefreshCw } from 'lucide-react';
import { Outlet } from 'react-router';
import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiRequestError } from '@/lib/api';
import { useMe } from './api';
import { WorkspaceContext } from './context';
import { Onboarding } from './onboarding';

function FullScreenMessage({
  title,
  text,
  onRetry,
  icon,
}: {
  title: string;
  text: string;
  onRetry?: () => void;
  icon?: boolean;
}) {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4">
      <div role="alert" className="max-w-sm text-center">
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-primary-soft text-primary-soft-foreground">
          {icon ? <Lock aria-hidden="true" className="size-6" /> : <LogoMark className="size-8" />}
        </span>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
        {onRetry ? (
          <Button variant="secondary" className="mt-5" onClick={onRetry}>
            <RefreshCw aria-hidden="true" /> Riprova
          </Button>
        ) : null}
      </div>
    </main>
  );
}

/**
 * Porta d'ingresso dell'applicazione: carica l'identità e decide cosa mostrare.
 * L'autorizzazione vera è sul server; questa schermata migliora solo l'esperienza.
 */
export function WorkspaceGate() {
  const me = useMe();

  if (me.isPending) {
    return (
      <div
        className="grid min-h-dvh place-items-center"
        role="status"
        aria-label="Caricamento in corso"
      >
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  if (me.isError) {
    const error = me.error;
    if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
      return (
        <FullScreenMessage
          icon
          title="Accesso non autorizzato"
          text="Questo spazio è privato. Accedi con l'account autorizzato per continuare."
        />
      );
    }
    return (
      <FullScreenMessage
        title="Non riusciamo a caricare i tuoi dati"
        text="Controlla la connessione e riprova."
        onRetry={() => void me.refetch()}
      />
    );
  }

  const workspace = me.data.workspaces[0];
  if (!workspace) return <Onboarding />;

  return (
    <WorkspaceContext.Provider value={{ user: me.data.user, workspace }}>
      <Outlet />
    </WorkspaceContext.Provider>
  );
}
