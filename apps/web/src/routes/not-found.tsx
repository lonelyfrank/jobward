import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Pagina non trovata"
      description="L’indirizzo che hai aperto non esiste o è stato spostato."
    >
      <Button asChild>
        <Link to="/">Torna all’Overview</Link>
      </Button>
    </EmptyState>
  );
}
