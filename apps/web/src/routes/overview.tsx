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
    <Surface className="px-5 pt-5 pb-[18px]">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
        {/* shrink-0: se l'etichetta va a capo l'icona non deve schiacciarsi */}
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary-soft text-primary-soft-foreground">
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-[32px] leading-tight font-bold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>
    </Surface>
  );
}

export function OverviewPage() {
  const { workspace } = useWorkspace();
  const overview = useOverview(workspace.id);

  const header = (
    <PageHeader
      title={`${greetingFor(new Date(), workspace.timezone)}!`}
      description={`Ecco a che punto è la tua ricerca in “${workspace.name}”.`}
      actions={
        <Button asChild>
          <Link to="/boards">
            <SquareKanban aria-hidden="true" />
            Le mie bacheche
          </Link>
        </Button>
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

  const { counts, upcomingTasks, recentBoards, recentCards } = overview.data;
  const steps = [
    { label: 'Crea il tuo workspace', done: true, milestone: null },
    {
      label: 'Crea la prima bacheca da un template',
      done: counts.boards > 0,
      milestone: null,
      to: '/boards',
    },
    {
      label: 'Aggiungi la prima opportunità',
      done: counts.opportunities > 0,
      milestone: null,
      to: counts.boards > 0 && recentBoards[0] ? `/boards/${recentBoards[0].id}` : '/boards',
    },
    { label: 'Pianifica un promemoria per ricontattare un’azienda', done: false, milestone: 'M3' },
  ] as const;

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
          hint="Con data di candidatura o fase successiva"
        />
        <StatCard
          icon={MessagesSquare}
          label="Colloqui"
          value={counts.interviews}
          hint="Fase “Colloquio”, senza esito definitivo"
        />
        <StatCard
          icon={ListChecks}
          label="Attività aperte"
          value={counts.openTasks}
          hint={
            counts.overdueTasks > 0
              ? `${counts.overdueTasks} scadute`
              : counts.openTasks > 0
                ? 'Nessuna scaduta'
                : 'Arrivano con M3'
          }
        />
        <StatCard icon={SquareKanban} label="Bacheche" value={counts.boards} hint="Nel workspace" />
      </section>

      {counts.boards === 0 || counts.opportunities === 0 ? (
        <Surface className="mt-5 p-6">
          <h2 className="text-[17px] font-bold">Inizia da qui</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            I numeri qui sopra si riempiono con i tuoi dati reali. Questi sono i primi passi:
          </p>
          <ol className="mt-4 space-y-2.5">
            {steps.map((step) => (
              <li key={step.label} className="flex items-start gap-2.5 text-sm max-md:items-center">
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
                {'to' in step && !step.done ? (
                  <Link
                    to={step.to}
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    {step.label}
                  </Link>
                ) : (
                  <span className={step.done ? 'text-muted-foreground line-through' : undefined}>
                    {step.label}
                  </span>
                )}
                {step.milestone ? <Badge tone="warning">In arrivo · {step.milestone}</Badge> : null}
              </li>
            ))}
          </ol>
        </Surface>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Surface className="p-6">
          <h2 className="flex items-center gap-2 text-[17px] font-bold">
            <BriefcaseBusiness aria-hidden="true" className="size-4 text-muted-foreground" />
            Opportunità recenti
          </h2>
          {recentCards.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Le schede che crei o sposti compariranno qui.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {recentCards.map((card) => (
                <li key={card.id}>
                  {/* Il link occupa tutta la riga: area di tocco ampia anche a telefono. */}
                  <Link
                    to={`/boards/${card.boardId}/cards/${card.id}`}
                    className="block rounded-md py-2 text-sm hover:bg-surface-muted max-md:py-3"
                  >
                    <span className="block font-medium">{card.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {card.boardName} · {card.columnName}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <Surface className="p-6">
          <h2 className="flex items-center gap-2 text-[17px] font-bold">
            <SquareKanban aria-hidden="true" className="size-4 text-muted-foreground" />
            Bacheche recenti
          </h2>
          {recentBoards.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Non hai ancora bacheche.{' '}
              <Link to="/boards" className="font-medium text-primary underline underline-offset-2">
                Creane una da un template
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {recentBoards.map((board) => (
                <li key={board.id}>
                  <Link
                    to={`/boards/${board.id}`}
                    className="block rounded-md py-2 text-sm font-medium hover:bg-surface-muted max-md:py-3"
                  >
                    {board.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>

      <Surface className="mt-5 p-6">
        <h2 className="flex items-center gap-2 text-[17px] font-bold">
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
    </>
  );
}
