import type { ReactNode } from 'react';
import './overview.css';
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
import { Link, useNavigate } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WorkspacePageHeader } from '@/components/ui/workspace-page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';
import { cardPath, NO_BOARD_LABEL } from '@/features/cards/card-path';
import { useOverview } from '@/features/overview/api';
import { useWorkspace } from '@/features/workspace/context';
import { formatCalendarDate, greetingFor } from '@/lib/format';

function OverviewFrame({
  children,
  onboarding = false,
}: {
  children: ReactNode;
  onboarding?: boolean;
}) {
  return (
    <div className="overview-page px-4 pt-5 pb-6 sm:px-6 lg:px-8" data-onboarding={onboarding}>
      {children}
    </div>
  );
}

function OverviewSection({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="overview-section">
      <h2 id={id} className="flex shrink-0 items-center gap-2 px-3 pb-3 text-[17px] font-bold">
        <Icon aria-hidden="true" className="size-[18px] shrink-0 text-muted-foreground" />
        {title}
      </h2>
      <div
        className="overview-section-content"
        role="region"
        aria-label={`Elenco: ${title}`}
        // La regione scorrevole deve essere raggiungibile da tastiera (WCAG 2.1.1).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
        {children}
      </div>
    </section>
  );
}

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
    <div className="min-w-0 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <Icon aria-hidden="true" className="size-7 shrink-0 text-primary-soft-foreground" />
        <p className="text-[1.75rem] leading-none font-bold tracking-tight tabular-nums">{value}</p>
      </div>
      <h2 className="mt-1.5 text-sm leading-5 font-semibold">{label}</h2>
      <p className="mt-0.5 max-w-56 text-[13px] leading-[1.4] text-muted-foreground">{hint}</p>
    </div>
  );
}

export function OverviewPage() {
  const { workspace } = useWorkspace();
  const overview = useOverview(workspace.id);
  const navigate = useNavigate();

  const header = (
    <WorkspacePageHeader
      title={`${greetingFor(new Date(), workspace.timezone)}!`}
      description={`Ecco a che punto è la tua ricerca in “${workspace.name}”.`}
      canCreateCard
      actions={[
        {
          id: 'boards',
          label: 'Le mie bacheche',
          icon: SquareKanban,
          group: 'navigate',
          onSelect: () => void navigate('/boards'),
        },
      ]}
    />
  );

  if (overview.isPending) {
    return (
      <OverviewFrame>
        {header}
        <div
          role="status"
          aria-label="Caricamento del riepilogo"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </OverviewFrame>
    );
  }

  if (overview.isError) {
    return (
      <OverviewFrame>
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
      </OverviewFrame>
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
    {
      label: 'Aggiungi la tua prima attività',
      done: counts.openTasks > 0,
      milestone: null,
      to: '/tasks',
    },
  ] as const;

  return (
    <OverviewFrame onboarding={counts.boards === 0 || counts.opportunities === 0}>
      {header}

      <section
        aria-label="Riepilogo"
        data-testid="stat-grid"
        className="grid w-full max-w-7xl shrink-0 grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-5"
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
                : 'Aggiungi la prima'
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
                    className="font-medium text-primary underline underline-offset-2 max-md:-my-3 max-md:inline-flex max-md:min-h-11 max-md:items-center"
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

      <div className="overview-panels">
        <div className="overview-recents">
          <OverviewSection
            id="overview-recent-opportunities"
            title="Opportunità recenti"
            icon={BriefcaseBusiness}
          >
            {recentCards.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Le schede che crei o sposti compariranno qui.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentCards.map((card) => (
                  <li key={card.id}>
                    {/* Il link occupa tutta la riga: area di tocco ampia anche a telefono. */}
                    <Link
                      to={cardPath(card)}
                      className="row-hover block px-3 py-2.5 text-sm max-md:py-3"
                    >
                      <span className="block font-medium break-words">{card.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {card.boardName
                          ? `${card.boardName} · ${card.columnName ?? ''}`
                          : NO_BOARD_LABEL}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </OverviewSection>

          <OverviewSection id="overview-recent-boards" title="Bacheche recenti" icon={SquareKanban}>
            {recentBoards.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Non hai ancora bacheche.{' '}
                <Link
                  to="/boards"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  Creane una da un template
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentBoards.map((board) => (
                  <li key={board.id}>
                    <Link
                      to={`/boards/${board.id}`}
                      className="row-hover block px-3 py-2.5 text-sm font-medium max-md:py-3"
                    >
                      {board.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </OverviewSection>
        </div>

        <OverviewSection id="overview-upcoming" title="Prossime scadenze" icon={CalendarClock}>
          {upcomingTasks.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Nessuna scadenza in arrivo. Le attività con una data compariranno qui.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {upcomingTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-sm"
                >
                  <Link
                    to="/tasks"
                    className="min-w-0 flex-1 break-words hover:underline max-md:py-2"
                  >
                    {task.title}
                  </Link>
                  <time className="shrink-0 text-muted-foreground" dateTime={task.dueOn}>
                    {formatCalendarDate(task.dueOn)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </OverviewSection>
      </div>
    </OverviewFrame>
  );
}
