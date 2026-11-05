import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { WorkspacePageHeader } from '@/components/ui/workspace-page-header';

export function NotFoundPage() {
  return (
    <>
      <WorkspacePageHeader
        title="Pagina non trovata"
        description="L’indirizzo che hai aperto non esiste o è stato spostato."
      />
      <Button asChild>
        <Link to="/">Torna all’Overview</Link>
      </Button>
    </>
  );
}
