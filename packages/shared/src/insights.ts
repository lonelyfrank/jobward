import type { Outcome, Stage } from './constants';
import { derivePipelineStatus, type PipelineStatus } from './pipeline';
import { localDate } from './tasks';

/**
 * Insights del percorso (roadmap E-01/E-02). Funzione PURA: riceve righe già lette e calcola metriche con
 * formule esplicite. Regole:
 * - le metriche contano le CANDIDATURE (non le schede) salvo dove indicato;
 * - un dato mancante non diventa zero: i casi esclusi sono sempre conteggiati e restituiti;
 * - il silenzio NON è un rifiuto: «nessuna risposta» conta solo se l'utente l'ha registrata;
 * - nessuna finestra temporale universale: i tempi di risposta usano solo le candidature con una risposta.
 */

export interface InsightOpportunityRow {
  id: string;
  archivedAt: number | null;
  source: string | null;
  workMode: string | null;
  benefits?: string | null;
  applicationCount: number;
}

export interface InsightApplicationRow {
  id: string;
  opportunityId: string;
  sequence: number;
  current: boolean;
  stage: Stage | null;
  outcome: Outcome | null;
  appliedOn: string | null;
  /** Archiviazione dell'opportunità (lo stato derivato la considera). */
  archivedAt: number | null;
}

/** Primo segnale dell'azienda dopo l'invio: stato `in_contact`/`interviewing`, colloquio o chiusura dell'azienda. */
export interface InsightResponseRow {
  opportunityId: string;
  occurredAt: number;
}

export interface InsightInterviewRow {
  opportunityId: string;
  status: string;
  scheduledAt: number | null;
}

export interface InsightsInput {
  now: number;
  timeZone: string;
  opportunities: InsightOpportunityRow[];
  applications: InsightApplicationRow[];
  /** Eventi che indicano una risposta, per opportunità (qualsiasi ordine). */
  responses: InsightResponseRow[];
  /** Fasi raggiunte in passato (metadato `to` degli eventi `stage_changed`), per opportunità. */
  reachedStages: { opportunityId: string; stage: Stage }[];
  interviews: InsightInterviewRow[];
}

export const FUNNEL_STEPS = ['applied', 'in_contact', 'interviewing', 'offer', 'hired'] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export interface Insights {
  totals: {
    opportunities: number;
    /** Opportunità attive senza alcuna candidatura (Inbox). */
    inbox: number;
    applications: number;
    /** Candidature correnti non chiuse e non archiviate. */
    activeApplications: number;
    interviews: number;
    upcomingInterviews: number;
    offers: number;
    hired: number;
  };
  /** Stato derivato della candidatura corrente per ogni opportunità con almeno una candidatura. */
  statusDistribution: { status: PipelineStatus; count: number }[];
  /** Candidature che hanno raggiunto ALMENO ciascun passo (fase attuale o fase registrata in passato). */
  funnel: { step: FunnelStep; count: number; rate: number | null }[];
  outcomes: { outcome: Outcome; count: number }[];
  responseTime: {
    /** Giorni interi dall'invio al primo segnale dell'azienda (mediana), `null` se nessun campione. */
    medianDays: number | null;
    sampleSize: number;
    /** Candidature inviate senza data d'invio: non misurabili. */
    withoutAppliedOn: number;
    /** Candidature inviate senza alcun segnale finora (non è un rifiuto). */
    awaitingResponse: number;
  };
  /** Candidature per settimana d'invio (lunedì, fuso del workspace), ultime 12 settimane. */
  weekly: { weekStart: string; count: number }[];
  sources: { source: string; count: number }[];
  workModes: { workMode: string; count: number }[];
  benefitsRecorded: number;
}

const STEP_RANK: Record<FunnelStep, number> = {
  applied: 1,
  in_contact: 2,
  interviewing: 3,
  offer: 4,
  hired: 5,
};

function stageRank(stage: Stage | null): number {
  switch (stage) {
    case 'applied':
      return 1;
    case 'in_contact':
      return 2;
    case 'interviewing':
      return 3;
    case 'offer':
      return 4;
    default:
      return 0;
  }
}

/** Lunedì della settimana di una data di calendario. */
export function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // lunedì = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : Math.round(((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2);
}

function countBy<T extends string>(values: T[]): { key: T; count: number }[] {
  const map = new Map<T, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

const isSubmitted = (a: InsightApplicationRow) =>
  a.appliedOn !== null || stageRank(a.stage) >= 1 || a.outcome !== null;

export function computeInsights(input: InsightsInput): Insights {
  const { now, timeZone } = input;
  const active = input.opportunities.filter((o) => o.archivedAt === null);
  const current = input.applications.filter((a) => a.current);

  const statusOf = (a: InsightApplicationRow) =>
    derivePipelineStatus({ stage: a.stage, outcome: a.outcome, archivedAt: a.archivedAt });

  const statusCounts = countBy(current.map(statusOf));
  const activeApplications = current.filter((a) => {
    const status = statusOf(a);
    return !['hired', 'rejected', 'withdrawn', 'no_response', 'archived'].includes(status);
  }).length;

  // Fase massima raggiunta per opportunità dagli eventi storici: vale per la sua candidatura CORRENTE se è la
  // prima, altrimenti si usa solo lo stato della candidatura (gli eventi legacy non distinguono le candidature).
  const reached = new Map<string, number>();
  for (const r of input.reachedStages) {
    reached.set(r.opportunityId, Math.max(reached.get(r.opportunityId) ?? 0, stageRank(r.stage)));
  }
  const interviewed = new Set(input.interviews.map((i) => i.opportunityId));
  const submitted = input.applications.filter(isSubmitted);
  const rankOf = (a: InsightApplicationRow): number => {
    let rank = Math.max(stageRank(a.stage), 1);
    if (a.sequence === 1) rank = Math.max(rank, reached.get(a.opportunityId) ?? 0);
    if (a.sequence === 1 && interviewed.has(a.opportunityId)) rank = Math.max(rank, 3);
    if (a.outcome === 'accepted') rank = 5;
    if (a.outcome === 'offer_declined') rank = Math.max(rank, 4);
    return rank;
  };
  const ranks = submitted.map(rankOf);
  const funnel = FUNNEL_STEPS.map((step, index) => {
    const count = ranks.filter((r) => r >= STEP_RANK[step]).length;
    const previous =
      index === 0 ? null : ranks.filter((r) => r >= STEP_RANK[FUNNEL_STEPS[index - 1]!]).length;
    return {
      step,
      count,
      rate: previous === null ? null : previous === 0 ? null : count / previous,
    };
  });

  // Tempi di risposta: solo prima candidatura (gli eventi sono per opportunità), solo con data d'invio.
  const firstResponse = new Map<string, number>();
  for (const r of input.responses) {
    const prev = firstResponse.get(r.opportunityId);
    if (prev === undefined || r.occurredAt < prev) firstResponse.set(r.opportunityId, r.occurredAt);
  }
  const samples: number[] = [];
  let withoutAppliedOn = 0;
  let awaitingResponse = 0;
  for (const a of submitted) {
    if (a.appliedOn === null) {
      withoutAppliedOn += 1;
      continue;
    }
    const response = a.sequence === 1 ? firstResponse.get(a.opportunityId) : undefined;
    if (response === undefined) {
      awaitingResponse += 1;
      continue;
    }
    const days = Math.round(
      (Date.parse(`${localDate(response, timeZone)}T00:00:00Z`) -
        Date.parse(`${a.appliedOn}T00:00:00Z`)) /
        86_400_000,
    );
    if (days >= 0) samples.push(days);
  }

  // Settimane: le ultime 12, compresa quella corrente, anche se vuote.
  const thisWeek = weekStartOf(localDate(now, timeZone));
  const weeks: string[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(`${thisWeek}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i * 7);
    weeks.push(d.toISOString().slice(0, 10));
  }
  const weekly = weeks.map((weekStart) => ({
    weekStart,
    count: submitted.filter((a) => a.appliedOn !== null && weekStartOf(a.appliedOn) === weekStart)
      .length,
  }));

  return {
    totals: {
      opportunities: active.length,
      inbox: active.filter((o) => o.applicationCount === 0).length,
      applications: input.applications.length,
      activeApplications,
      interviews: input.interviews.filter((i) => i.status !== 'cancelled').length,
      upcomingInterviews: input.interviews.filter(
        (i) => i.status === 'scheduled' && i.scheduledAt !== null && i.scheduledAt >= now,
      ).length,
      offers: ranks.filter((r) => r >= STEP_RANK.offer).length,
      hired: input.applications.filter((a) => a.outcome === 'accepted').length,
    },
    statusDistribution: statusCounts.map(({ key, count }) => ({ status: key, count })),
    funnel,
    outcomes: countBy(
      input.applications.map((a) => a.outcome).filter((o): o is Outcome => o !== null),
    ).map(({ key, count }) => ({ outcome: key, count })),
    responseTime: {
      medianDays: median(samples),
      sampleSize: samples.length,
      withoutAppliedOn,
      awaitingResponse,
    },
    weekly,
    benefitsRecorded: active.filter((opportunity) => opportunity.benefits?.trim()).length,
    sources: countBy(active.map((o) => o.source?.trim()).filter((s): s is string => !!s)).map(
      ({ key, count }) => ({ source: key, count }),
    ),
    workModes: countBy(active.map((o) => o.workMode).filter((w): w is string => !!w)).map(
      ({ key, count }) => ({ workMode: key, count }),
    ),
  };
}
