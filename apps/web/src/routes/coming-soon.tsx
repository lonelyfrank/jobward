import { BarChart3, ListChecks, Table2, type LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';

function ComingSoon({
  title,
  description,
  icon,
  milestone,
  emptyTitle,
  emptyText,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  milestone: string;
  emptyTitle: string;
  emptyText: string;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState icon={icon} milestone={milestone} title={emptyTitle} description={emptyText} />
    </>
  );
}

export const OpportunitiesPage = () => (
  <ComingSoon
    title="Opportunità"
    description="Tutte le tue schede in una tabella, tra bacheche diverse."
    icon={Table2}
    milestone="M2"
    emptyTitle="Qui vedrai tutte le opportunità"
    emptyText="Ricerca, filtri e ordinamento per azienda, priorità e fase arrivano con la vista tabella."
  />
);

export const TasksPage = () => (
  <ComingSoon
    title="Attività"
    description="Promemoria, follow-up e scadenze della tua ricerca."
    icon={ListChecks}
    milestone="M3"
    emptyTitle="Nessuna attività, per ora"
    emptyText="Potrai collegare attività e scadenze a ogni scheda, per non dimenticare di ricontattare un’azienda."
  />
);

export const InsightsPage = () => (
  <ComingSoon
    title="Insights"
    description="Una lettura chiara dell’andamento della tua ricerca."
    icon={BarChart3}
    milestone="M4"
    emptyTitle="Le statistiche nascono dai tuoi dati"
    emptyText="Quando avrai registrato candidature e colloqui vedrai tempi di risposta e andamento per fase."
  />
);
