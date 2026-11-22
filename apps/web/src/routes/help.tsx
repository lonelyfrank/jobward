import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { Surface } from '@/components/ui/surface';
import { WorkspacePageHeader } from '@/components/ui/workspace-page-header';

const GUIDE = [
  {
    to: '/boards',
    title: 'Organizza le opportunità',
    description: 'Crea una bacheca, scegli le colonne e aggiungi le offerte che ti interessano.',
  },
  {
    to: '/opportunities',
    title: 'Segui le candidature',
    description: 'Ritrova le opportunità e apri una scheda per aggiornare fase, colloqui e note.',
  },
  {
    to: '/tasks',
    title: 'Pianifica il prossimo passo',
    description: 'Annota le attività, imposta una scadenza e tieni a portata di mano i follow-up.',
  },
  {
    to: '/settings',
    title: 'Personalizza il workspace',
    description: 'Scegli il tema dell’interfaccia e gestisci le etichette delle opportunità.',
  },
];

export function HelpPage() {
  return (
    <>
      <WorkspacePageHeader
        title="Aiuto"
        description="Qualche indicazione per trovare il tuo ritmo con Jobward."
      />
      <div className="max-w-2xl space-y-6">
        <Surface className="p-5">
          <h2 className="px-2 text-[17px] font-bold">Da dove iniziare</h2>
          <ul className="mt-3 space-y-1">
            {GUIDE.map(({ to, title, description }) => (
              <li key={to}>
                <Link to={to} className="row-hover flex items-center gap-4 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Surface>
        <Surface className="p-6">
          <h2 className="text-[17px] font-bold">Documentazione e segnalazioni</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Trovi la documentazione del progetto su GitHub. Puoi anche segnalare un problema o
            proporre un miglioramento.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-4 text-sm font-medium">
            <a
              href="https://github.com/lonelyfrank/jobward#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-primary hover:underline"
            >
              Documentazione <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
            <a
              href="https://github.com/lonelyfrank/jobward/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-primary hover:underline"
            >
              Segnala un problema <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
          </div>
        </Surface>
      </div>
    </>
  );
}
