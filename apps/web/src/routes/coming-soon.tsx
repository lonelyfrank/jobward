import { BarChart3, type LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { WorkspacePageHeader } from '@/components/ui/workspace-page-header';

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
      <WorkspacePageHeader title={title} description={description} />
      <EmptyState icon={icon} milestone={milestone} title={emptyTitle} description={emptyText} />
    </>
  );
}

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
