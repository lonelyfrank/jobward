import {
  opportunitiesMapResponse,
  opportunitiesResponse,
  opportunityCitiesResponse,
} from '@jobward/schemas';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { keys, scoped } from '@/features/boards/api';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest, ApiRequestError } from '@/lib/api';

/**
 * Ricerca sulle opportunità. La chiave contiene i parametri: una nuova ricerca annulla (tramite
 * `signal`) quella ancora in corso, e durante il caricamento si mantiene la pagina precedente
 * invece di svuotare la tabella.
 */
export function useOpportunities(query: Record<string, string>, enabled = true) {
  const { workspace } = useWorkspace();
  return useQuery({
    enabled,
    queryKey: [...keys.opportunities(workspace.id), query],
    queryFn: ({ signal }) =>
      apiRequest(
        scoped(workspace.id, `/opportunities?${new URLSearchParams(query).toString()}`),
        opportunitiesResponse,
        { signal },
      ),
    placeholderData: keepPreviousData,
    // Un errore di validazione non migliora ritentando; un guasto passeggero sì, ma una volta sola
    // e in fretta: l'utente non deve restare sette secondi davanti a "Ricerca in corso…".
    retry: (count, error) => {
      const status = error instanceof ApiRequestError ? error.status : 0;
      return !(status >= 400 && status < 500) && count < 1;
    },
    retryDelay: 400,
  });
}

/**
 * Vista Mappa (D-07): tutte le opportunità filtrate, in forma leggera. La chiave sta sotto
 * `keys.opportunities`, così ogni modifica a una scheda aggiorna anche la mappa.
 */
export function useOpportunityMap(query: Record<string, string>) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: [...keys.opportunities(workspace.id), 'map', query],
    queryFn: ({ signal }) =>
      apiRequest(
        scoped(workspace.id, `/opportunities/map?${new URLSearchParams(query).toString()}`),
        opportunitiesMapResponse,
        { signal },
      ),
    placeholderData: keepPreviousData,
    retry: (count, error) => {
      const status = error instanceof ApiRequestError ? error.status : 0;
      return !(status >= 400 && status < 500) && count < 1;
    },
    retryDelay: 400,
  });
}

/** Città usate nelle opportunità (D-07): opzioni del filtro «Città», aggiornate con le schede. */
export function useOpportunityCities() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: [...keys.opportunities(workspace.id), 'cities'],
    queryFn: ({ signal }) =>
      apiRequest(scoped(workspace.id, '/opportunities/cities'), opportunityCitiesResponse, {
        signal,
      }),
  });
}
