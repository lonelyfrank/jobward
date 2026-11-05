import { Outlet } from 'react-router';
import { PageHeader } from '@/components/ui/page-header';
import { OpportunitiesView } from '@/features/opportunities/opportunities-view';

/** Tutte le opportunità del workspace, tra bacheche diverse. Caricata a richiesta (route lazy). */
export function Component() {
  return (
    <>
      <PageHeader
        title="Opportunità"
        description="Tutte le tue schede in una tabella: cerca, filtra e ordina tra bacheche diverse."
      />
      <OpportunitiesView />
      {/* Pannello di dettaglio: sotto la stessa rotta, ricerca e filtri restano nell'indirizzo. */}
      <Outlet />
    </>
  );
}
