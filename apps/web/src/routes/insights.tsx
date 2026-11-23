import type { InsightsResponse } from '@jobward/schemas';
import type { FunnelStep } from '@jobward/shared';
import {
  BriefcaseBusiness,
  CalendarClock,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  Info,
  ListChecks,
  Inbox,
  MessagesSquare,
  Send,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import './insights.css';
import { Link } from 'react-router';
import { Surface } from '@/components/ui/surface';
import { Tooltip } from '@/components/ui/tooltip';
import { WorkspacePageHeader } from '@/components/ui/workspace-page-header';
import { useInsights } from '@/features/insights/api';
import { OUTCOME_LABELS, WORK_MODE_LABELS } from '@/lib/labels';

const FUNNEL_LABELS: Record<FunnelStep, string> = {
  applied: 'Inviate',
  in_contact: 'Contattato',
  interviewing: 'Colloquio',
  offer: 'Offerta',
  hired: 'Assunto',
};

const RESPONSE_TIME_NOTE =
  'Giorni dall’invio al primo segnale dell’azienda (contatto, colloquio, esito). Il silenzio non è un rifiuto: le candidature senza risposta restano «in attesa» e non entrano nella mediana.';

const percent = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <Icon aria-hidden="true" className="size-7 shrink-0 text-primary-soft-foreground" />
        <p className="min-w-0 text-[1.75rem] leading-none font-bold tracking-tight break-words tabular-nums">
          {value}
        </p>
      </div>
      <h2 className="mt-1.5 text-sm leading-5 font-semibold">{label}</h2>
      {hint ? (
        <p className="mt-0.5 max-w-56 text-[13px] leading-[1.4] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Icona "i" con la spiegazione di come si calcola un indicatore. */
function InfoTip({ label, content }: { label: string; content: string }) {
  return (
    <Tooltip content={content} side="top">
      <button
        type="button"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        aria-label={label}
      >
        <Info className="size-4" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

function MetricPanel({
  title,
  info,
  footer,
  children,
}: {
  title: string;
  info?: string;
  /** Nota o sottotitolo: sempre in fondo alla card, fuori dall'area che scorre. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <Surface className="insights-panel">
      <div className="flex shrink-0 items-center gap-1 px-5 pt-3 pb-2">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        {info ? <InfoTip label={`Come si calcola: ${title}`} content={info} /> : null}
      </div>
      <div
        className="insights-panel-body"
        role="region"
        aria-labelledby={titleId}
        // Keyboard users can scroll long charts without moving the page.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
        {children}
      </div>
      {footer ? (
        <p className="shrink-0 px-5 pt-2 pb-3 text-xs text-muted-foreground">{footer}</p>
      ) : null}
    </Surface>
  );
}

function MetricCarousel({ children }: { children: ReactNode[] }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(2);
  const viewportId = useId();
  const last = children.length - visible;

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const resize = new ResizeObserver(() => {
      const count = window.matchMedia('(min-width: 1024px)').matches ? 2 : 1;
      setVisible(count);
      const step = (element.clientWidth + 16) / count;
      const index = Math.min(children.length - count, Math.round(element.scrollLeft / step));
      element.scrollTo({ left: index * step, behavior: 'instant' });
      setActive(index);
    });
    resize.observe(element);
    return () => resize.disconnect();
  }, [children.length]);

  function goTo(index: number) {
    const element = viewport.current;
    if (!element) return;
    element.scrollTo({
      left: (Math.max(0, Math.min(last, index)) * (element.clientWidth + 16)) / visible,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }

  return (
    <section
      className="insights-carousel"
      aria-label="Analisi della ricerca"
      aria-roledescription="carosello"
    >
      <div
        id={viewportId}
        ref={viewport}
        className="insights-carousel-viewport"
        onScroll={() => {
          const element = viewport.current;
          if (element)
            setActive(
              Math.max(
                0,
                Math.min(
                  last,
                  Math.round(element.scrollLeft / ((element.clientWidth + 16) / visible)),
                ),
              ),
            );
        }}
      >
        {children.map((child, index) => (
          <div
            key={index}
            className="insights-slide"
            role="group"
            aria-roledescription="diapositiva"
            aria-label={`${index + 1} di ${children.length}`}
          >
            {child}
          </div>
        ))}
      </div>
      <div className="insights-carousel-controls flex shrink-0 items-center justify-center pt-2">
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          Metriche {active + 1}
          {visible === 2 ? `–${active + visible}` : ''} di {children.length}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Metriche precedenti"
            aria-controls={viewportId}
            // A inizio corsa si riparte dalla fine (e viceversa): il carosello è circolare.
            onClick={() => goTo(active <= 0 ? last : active - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          {Array.from({ length: last + 1 }, (_, index) => (
            <button
              key={index}
              type="button"
              className="grid size-8 place-items-center rounded-full"
              aria-label={`Mostra metriche da ${index + 1}`}
              aria-controls={viewportId}
              aria-current={index === active ? 'true' : undefined}
              onClick={() => goTo(index)}
            >
              <span
                className={`size-1.5 rounded-full ${index === active ? 'bg-primary' : 'bg-muted-foreground/50'}`}
              />
            </button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Metriche successive"
            aria-controls={viewportId}
            onClick={() => goTo(active >= last ? 0 : active + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Barre orizzontali: ogni riga mostra anche il numero, quindi il grafico è leggibile come testo. */
function Bars({
  title,
  rows,
  empty,
  note,
  info,
}: {
  title: string;
  rows: { label: string; value: number; detail?: string }[];
  empty: string;
  note?: string;
  info?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <MetricPanel title={title} {...(info ? { info } : {})} {...(note ? { footer: note } : {})}>
      {rows.length === 0 || rows.every((r) => r.value === 0) ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{row.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {row.value}
                  {row.detail ? ` · ${row.detail}` : ''}
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-surface-muted" aria-hidden="true">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </MetricPanel>
  );
}

function Weekly({ weekly }: { weekly: InsightsResponse['weekly'] }) {
  const max = Math.max(1, ...weekly.map((w) => w.count));
  const total = weekly.reduce((sum, w) => sum + w.count, 0);
  const label = (date: string) =>
    new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(`${date}T00:00:00Z`),
    );
  return (
    <MetricPanel
      title="Candidature per settimana"
      footer={`${total} nelle ultime 12 settimane (per data d’invio).`}
    >
      <div className="flex h-full min-h-32 flex-col">
        <ol
          className="flex min-h-0 flex-1 items-end gap-1.5"
          aria-label="Candidature inviate per settimana"
        >
          {weekly.map((w) => (
            <li
              key={w.weekStart}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {w.count > 0 ? w.count : ''}
              </span>
              <div
                className="w-full rounded-t-md bg-primary/80"
                style={{ height: `${(w.count / max) * 85}%`, minHeight: w.count > 0 ? 4 : 0 }}
                aria-hidden="true"
              />
              <span className="sr-only">
                Settimana del {label(w.weekStart)}: {w.count}
              </span>
            </li>
          ))}
        </ol>
        <div
          className="mt-1 flex justify-between text-[11px] text-muted-foreground"
          aria-hidden="true"
        >
          <span>{label(weekly[0]?.weekStart ?? '1970-01-05')}</span>
          <span>{label(weekly.at(-1)?.weekStart ?? '1970-01-05')}</span>
        </div>
      </div>
    </MetricPanel>
  );
}

function Sources({ sources, total }: { sources: InsightsResponse['sources']; total: number }) {
  const known = sources.filter((source) => source.count > 0);
  const recorded = known.reduce((sum, source) => sum + source.count, 0);
  const missing = Math.max(0, total - recorded);
  const slices = [
    ...known.map((source, index) => ({
      label: source.source,
      count: source.count,
      color: `hsl(${(255 + index * 137.5) % 360} 65% 62%)`,
    })),
    ...(missing > 0
      ? [{ label: 'Fonte non indicata', count: missing, color: 'var(--muted-foreground)' }]
      : []),
  ];
  const sum = recorded + missing;
  const gradient = slices
    .map((slice, index) => {
      const start =
        (slices.slice(0, index).reduce((value, item) => value + item.count, 0) / sum) * 100;
      return `${slice.color} ${start}% ${start + (slice.count / sum) * 100}%`;
    })
    .join(', ');
  return (
    <MetricPanel
      title="Da dove arrivano le opportunità"
      {...(recorded > 0
        ? {
            footer: `${recorded} su ${total} opportunità attive con fonte indicata. Percentuali sul totale delle opportunità attive.`,
          }
        : {})}
    >
      {recorded === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Indica la fonte nei dettagli delle opportunità per vedere da dove arrivano.
        </p>
      ) : (
        <figure className="insights-sources">
          <div className="insights-sources-layout">
            <div
              aria-hidden="true"
              className="insights-sources-pie rounded-full"
              style={{ background: `conic-gradient(${gradient})` }}
            />
            <ul className="min-w-0 space-y-2" aria-label="Provenienza delle opportunità">
              {slices.map((slice, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ background: slice.color }}
                  />
                  <span className="min-w-0 flex-1 break-words">{slice.label}</span>
                  <span className="shrink-0 tabular-nums">
                    {slice.count} · {Math.round((slice.count / sum) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </figure>
      )}
    </MetricPanel>
  );
}

/** Insights del percorso: formule esplicite, casi esclusi dichiarati, nessuna stima presentata come certa. */
export function Component() {
  const insights = useInsights();
  const header = <WorkspacePageHeader title="Insights" />;
  if (insights.isPending) {
    return (
      <div className="insights-page px-4 pt-5 pb-4 sm:px-6 lg:px-8">
        {header}
        <p className="text-sm text-muted-foreground">Calcolo degli insights…</p>
      </div>
    );
  }
  if (insights.isError) {
    return (
      <div className="insights-page px-4 pt-5 pb-4 sm:px-6 lg:px-8">
        {header}
        <Surface className="p-6" role="alert">
          Non siamo riusciti a calcolare gli insights. Riprova tra poco.
        </Surface>
      </div>
    );
  }
  const data = insights.data;
  const { totals, responseTime } = data;

  return (
    <div className="insights-page px-4 pt-5 pb-4 sm:px-6 lg:px-8">
      {header}
      <section
        aria-label="Indicatori principali"
        className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-6"
      >
        <Metric
          icon={BriefcaseBusiness}
          label="Opportunità"
          value={totals.opportunities}
          hint="Attive (non archiviate)"
        />
        <Metric icon={Inbox} label="Inbox" value={totals.inbox} hint="Salvate, senza candidatura" />
        <Metric
          icon={Send}
          label="Candidature"
          value={totals.applications}
          hint={`${totals.activeApplications} in corso`}
        />
        <Metric
          icon={MessagesSquare}
          label="Colloqui"
          value={totals.interviews}
          hint={`${totals.upcomingInterviews} in programma`}
        />
        <Metric
          icon={Trophy}
          label="Offerte"
          value={totals.offers}
          hint={`${totals.hired} accettate`}
        />
        <Metric
          icon={CalendarClock}
          label="Risposta (mediana)"
          value={responseTime.medianDays === null ? '—' : `${responseTime.medianDays} g`}
          hint={
            responseTime.sampleSize > 0
              ? `Su ${responseTime.sampleSize} candidature con risposta`
              : 'Nessuna risposta registrata'
          }
        />
      </section>

      <MetricCarousel>
        <Bars
          title="Funnel delle candidature"
          rows={data.funnel.map((s) => ({
            label: FUNNEL_LABELS[s.step],
            value: s.count,
            ...(s.rate !== null ? { detail: `${percent(s.rate)} dal passo precedente` } : {}),
          }))}
          empty="Il funnel compare quando registri la prima candidatura."
          info="Conta le candidature che hanno raggiunto almeno ciascun passo (fase attuale o registrata in passato)."
        />
        <Weekly weekly={data.weekly} />

        <Bars
          title="Esiti registrati"
          rows={data.outcomes.map((o) => ({ label: OUTCOME_LABELS[o.outcome], value: o.count }))}
          empty="Nessun esito registrato."
        />
        <Bars
          title="Modalità di lavoro e benefit"
          rows={data.workModes.map((w) => ({
            label: WORK_MODE_LABELS[w.workMode as keyof typeof WORK_MODE_LABELS] ?? w.workMode,
            value: w.count,
          }))}
          empty="Nessuna modalità indicata."
          note={`Benefit indicati in ${data.benefitsRecorded} su ${totals.opportunities} opportunità attive. Il conteggio indica la presenza di una descrizione dei benefit.`}
        />
        <Sources sources={data.sources} total={totals.opportunities} />
        <MetricPanel title="Tempi di risposta" info={RESPONSE_TIME_NOTE}>
          <div
            role="group"
            className="grid grid-cols-2 gap-x-3 gap-y-1"
            aria-label="Indicatori dei tempi di risposta"
          >
            <Metric
              icon={CalendarClock}
              label="Mediana"
              value={responseTime.medianDays === null ? '—' : `${responseTime.medianDays} g`}
              hint="Giorni fino alla prima risposta"
            />
            <Metric
              icon={ListChecks}
              label="Campione"
              value={responseTime.sampleSize}
              hint="Candidature con risposta"
            />
            <Metric
              icon={Hourglass}
              label="In attesa di risposta"
              value={responseTime.awaitingResponse}
              hint="Con data d’invio registrata"
            />
            <Metric
              icon={CalendarX2}
              label="Senza data d’invio"
              value={responseTime.withoutAppliedOn}
              hint="Escluse dal calcolo dei tempi"
            />
          </div>
        </MetricPanel>
      </MetricCarousel>
      {/* Piè di pagina: sempre in fondo alla vista, senza allungare la pagina. */}
      <p className="mt-auto border-t border-border px-3 pt-2 text-xs text-muted-foreground">
        Vuoi i dati grezzi? Esportali da{' '}
        <Link to="/settings" className="underline">
          Impostazioni
        </Link>
        .
      </p>
    </div>
  );
}
