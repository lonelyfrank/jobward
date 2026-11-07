import { Button } from '@/components/ui/button';
import { ApiRequestError } from '@/lib/api';
import { userMessage } from '@/features/kanban/mutations';

export function workflowError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 404) return 'Questa risorsa non è più disponibile. Aggiorna i dati.';
    if (error.status === 400)
      return error.issues?.map((i) => i.message).join(' · ') || error.message;
    if (error.status === 409)
      return error.message + ' Aggiorna i dati prima di preparare una nuova operazione.';
  }
  return 'La risposta non è arrivata: l’operazione potrebbe essere riuscita. Riprova la stessa richiesta per verificarlo.';
}

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" className="space-y-2 text-sm text-danger">
      <p>{userMessage(error, 'Non riusciamo a caricare i dati.')}</p>
      <Button variant="secondary" onClick={onRetry}>
        Riprova
      </Button>
    </div>
  );
}
