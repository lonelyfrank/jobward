import {
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Circle,
  ListChecks,
  MessagesSquare,
  Send,
  SquareKanban,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { PlannedAction } from '@/components/planned-action';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';
import { useOverview } from '@/features/overview/api';
import { useWorkspace } from '@/features/workspace/context';
import { formatDateTime, greetingFor } from '@/lib/format';

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Surface className="p-4">
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        {/* shrink-0: se l'etichetta va a capo l'icona non deve schiacciarsi */}
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {label}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Surface>
  );
}

const GETTING_STARTED = [
  { label: 'Crea il tuo workspace', done: true, milestone: null },
  { label: 'Crea la prima bacheca da un template', done: false, milestone: 'M1' },
  { label: 'Aggiungi la prima opportunità', done: false, milestone: 'M1' },
  { label: 'Pianifica un promemoria per ricontattare un’azienda', done: false, milestone: 'M3' },
] as const;

export function OverviewPage() {
  const { workspace } = useWorkspace();
  const overview = useOverview(workspace.id);

  const header = (
    <PageHeader
      title={`${greetingFor(new Date(), workspace.timezone)}!`}
      description={`Ecco a che punto è la tua ricerca in “${workspace.name}”.`}
      actions={
        <PlannedAction id="overview-new-card" milestone="M1" variant="primary">
          Nuova opportunità
        </PlannedAction>
      }
    />
  );

  if (overview.isPending) {
    return (
      <>
        {header}
        <div
          role="status"
          aria-label="Caricamento del riepilogo"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </>
    );
  }

  if (overview.isError) {
    return (
      <>
        {header}
        <Surface className="p-6" role="alert">
          <p className="font-medium">Non riusciamo a caricare il riepilogo.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            I tuoi dati sono al sicuro: riprova tra un momento.
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => void overview.refetch()}>
            Riprova
          </Button>
        </Surface>
      </>
    );
  }

  const { counts, upcomingTasks, recentBoards } = overview.data;

  return (
    <>
      {header}

      <section
        aria-label="Riepilogo"
        data-testid="stat-grid"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 sm:max-xl:[&>:last-child:nth-child(odd)]:col-span-2"
      >
        <StatCard
          icon={BriefcaseBusiness}
          label="Opportunità"
          value={counts.opportunities}
          hint="Schede attive"
        />
        <StatCard
          icon={Send}
          label="Candidature inviate"
          value={counts.applicationsSubmitted}
          hint="Con data di invio"
        />
        <StatCard
          icon={MessagesSquare}
          label="Colloqui"
          value={counts.interviews}
          hint="In fase colloquio"
        />
        <StatCard
          icon={ListChecks}
          label="Attività aperte"
          value={counts.openTasks}
          hint={counts.overdueTasks > 0 ? `${counts.overdueTasks} scadute` : 'Nessuna scaduta'}
        />
        <StatCard icon={SquareKanban} label="Bacheche" value={counts.boards} hint="Nel workspace" />
      </section>

      {counts.boards === 0 ? (
        <Surface className="mt-6 p-6">
          <h2 className="font-semibold">Inizia da qui</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            I numeri qui sopra si riempiranno con i tuoi dati reali. Questi sono i primi passi:
          </p>
          <ol className="mt-4 space-y-2.5">
            {GETTING_STARTED.map((step) => (
              <li key={step.label} className="flex items-start gap-2.5 text-sm">
                {step.done ? (
                  <CheckCircle2
                    aria-label="Completato"
                    className="mt-0.5 size-4 shrink-0 text-primary"
                  />
                ) : (
                  <Circle
                    aria-label="Da fare"
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  />
                )}
                <span className={step.done ? 'text-muted-foreground line-through' : undefined}>
                  {step.label}
                </span>
                {step.milestone ? <Badge tone="warning">In arrivo · {step.milestone}</Badge> : null}
              </li>
            ))}
          </ol>
        </Surface>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Surface className="p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <CalendarClock aria-hidden="true" className="size-4 text-muted-foreground" />
            Prossime scadenze
          </h2>
          {upcomingTasks.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nessuna scadenza in arrivo. Le attività con una data compariranno qui.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {upcomingTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="truncate">{task.title}</span>
                  <time
                    className="shrink-0 text-muted-foreground"
                    dateTime={new Date(task.dueAt).toISOString()}
                  >
                    {formatDateTime(task.dueAt, workspace.timezone)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <Surface className="p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <SquareKanban aria-hidden="true" className="size-4 text-muted-foreground" />
            Bacheche recenti
          </h2>
          {recentBoards.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Non hai ancora bacheche. Vedi i{' '}
              <Link to="/boards" className="font-medium text-primary underline underline-offset-2">
                template di partenza
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {recentBoards.map((board) => (
                <li key={board.id} className="py-2 text-sm">
                  <Link to={`/boards/${board.id}`} className="font-medium hover:underline">
                    {board.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>
    </>
  );
}
