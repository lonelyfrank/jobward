import { BOARD_TEMPLATES } from '@meet-roulette/shared';
import { SquareKanban } from 'lucide-react';
import { PlannedAction } from '@/components/planned-action';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Surface } from '@/components/ui/surface';

export function BoardsPage() {
  return (
    <>
      <PageHeader
        title="Bacheche"
        description="Una bacheca raccoglie le opportunità di una ricerca, organizzate nelle tue colonne."
        actions={
          <PlannedAction id="boards-new" milestone="M1" variant="primary">
            Nuova bacheca
          </PlannedAction>
        }
      />

      <EmptyState
        icon={SquareKanban}
        milestone="M1"
        title="Non hai ancora bacheche"
        description="Creazione, modifica e Kanban con trascinamento arrivano nella prossima milestone. Qui sotto trovi i template tra cui potrai scegliere."
      />

      <section aria-labelledby="templates-title" className="mt-8">
        <h2 id="templates-title" className="text-sm font-semibold">
          Template di partenza
        </h2>
        <ul className="mt-3 grid gap-4 md:grid-cols-3">
          {BOARD_TEMPLATES.map((template) => (
            <li key={template.id}>
              <Surface className="h-full p-4">
                <h3 className="font-medium">{template.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
                {template.columns.length > 0 ? (
                  <ol
                    aria-label={`Colonne di ${template.name}`}
                    className="mt-3 flex flex-wrap gap-1.5"
                  >
                    {template.columns.map((column) => (
                      <li key={column.name}>
                        <Badge>{column.name}</Badge>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Nessuna colonna: la costruisci tu.
                  </p>
                )}
              </Surface>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function BoardPlaceholderPage() {
  return (
    <>
      <PageHeader title="Bacheca" />
      <EmptyState
        icon={SquareKanban}
        milestone="M1"
        title="La vista Kanban arriva in M1"
        description="Colonne, schede e trascinamento saranno disponibili nella prossima milestone."
      />
    </>
  );
}
