import { describe, expect, it } from 'vitest';
import { computeInsights, weekStartOf, type InsightsInput } from './insights';

const NOW = Date.parse('2026-11-21T10:00:00Z');
const day = (d: string) => Date.parse(`${d}T09:00:00Z`);

const base = (over: Partial<InsightsInput> = {}): InsightsInput => ({
  now: NOW,
  timeZone: 'Europe/Rome',
  opportunities: [],
  applications: [],
  responses: [],
  reachedStages: [],
  interviews: [],
  ...over,
});

describe('computeInsights', () => {
  it('con dati vuoti restituisce zeri e nessuna mediana (mai valori inventati)', () => {
    const r = computeInsights(base());
    expect(r.totals.opportunities).toBe(0);
    expect(r.responseTime.medianDays).toBeNull();
    expect(r.funnel.every((s) => s.count === 0)).toBe(true);
    expect(r.weekly).toHaveLength(12);
  });

  it('distingue Inbox, candidature attive e chiuse', () => {
    const r = computeInsights(
      base({
        opportunities: [
          {
            id: 'o1',
            archivedAt: null,
            source: 'LinkedIn',
            workMode: 'remote',
            applicationCount: 0,
          },
          { id: 'o2', archivedAt: null, source: 'linkedin ', workMode: null, applicationCount: 1 },
          { id: 'o3', archivedAt: null, source: null, workMode: 'hybrid', applicationCount: 1 },
        ],
        applications: [
          {
            id: 'a2',
            opportunityId: 'o2',
            sequence: 1,
            current: true,
            stage: 'applied',
            outcome: null,
            appliedOn: '2026-11-03',
            archivedAt: null,
          },
          {
            id: 'a3',
            opportunityId: 'o3',
            sequence: 1,
            current: true,
            stage: 'closed',
            outcome: 'rejected',
            appliedOn: '2026-11-01',
            archivedAt: null,
          },
        ],
      }),
    );
    expect(r.totals).toMatchObject({
      opportunities: 3,
      inbox: 1,
      applications: 2,
      activeApplications: 1,
    });
    expect(r.outcomes).toEqual([{ outcome: 'rejected', count: 1 }]);
    expect(r.statusDistribution.map((s) => s.status).sort()).toEqual(['applied', 'rejected']);
  });

  it('funnel: conta la fase massima raggiunta, anche da eventi passati e colloqui', () => {
    const r = computeInsights(
      base({
        applications: [
          {
            id: 'a1',
            opportunityId: 'o1',
            sequence: 1,
            current: true,
            stage: 'closed',
            outcome: 'rejected',
            appliedOn: '2026-11-01',
            archivedAt: null,
          },
          {
            id: 'a2',
            opportunityId: 'o2',
            sequence: 1,
            current: true,
            stage: 'applied',
            outcome: null,
            appliedOn: '2026-11-02',
            archivedAt: null,
          },
        ],
        reachedStages: [{ opportunityId: 'o1', stage: 'interviewing' }],
      }),
    );
    expect(r.funnel.find((s) => s.step === 'applied')?.count).toBe(2);
    expect(r.funnel.find((s) => s.step === 'interviewing')?.count).toBe(1);
    expect(r.funnel.find((s) => s.step === 'interviewing')?.rate).toBeCloseTo(1);
    expect(r.funnel.find((s) => s.step === 'offer')?.count).toBe(0);
  });

  it('tempi di risposta: mediana sui soli casi con risposta; il silenzio resta «in attesa»', () => {
    const r = computeInsights(
      base({
        applications: [
          {
            id: 'a1',
            opportunityId: 'o1',
            sequence: 1,
            current: true,
            stage: 'in_contact',
            outcome: null,
            appliedOn: '2026-11-01',
            archivedAt: null,
          },
          {
            id: 'a2',
            opportunityId: 'o2',
            sequence: 1,
            current: true,
            stage: 'applied',
            outcome: null,
            appliedOn: '2026-11-02',
            archivedAt: null,
          },
          {
            id: 'a3',
            opportunityId: 'o3',
            sequence: 1,
            current: true,
            stage: 'applied',
            outcome: null,
            appliedOn: null,
            archivedAt: null,
          },
        ],
        responses: [
          { opportunityId: 'o1', occurredAt: day('2026-11-08') },
          { opportunityId: 'o1', occurredAt: day('2026-11-05') },
        ],
      }),
    );
    expect(r.responseTime).toEqual({
      medianDays: 4,
      sampleSize: 1,
      withoutAppliedOn: 1,
      awaitingResponse: 1,
    });
  });

  it('settimane: raggruppa per lunedì nel fuso del workspace', () => {
    expect(weekStartOf('2026-11-22')).toBe('2026-11-16');
    const r = computeInsights(
      base({
        applications: [
          {
            id: 'a1',
            opportunityId: 'o1',
            sequence: 1,
            current: true,
            stage: 'applied',
            outcome: null,
            appliedOn: '2026-11-17',
            archivedAt: null,
          },
        ],
      }),
    );
    expect(r.weekly.at(-1)).toEqual({ weekStart: '2026-11-16', count: 1 });
  });
});

it('benefit e fonti: solo opportunità attive e descrizioni effettivamente compilate', () => {
  const r = computeInsights(
    base({
      opportunities: [
        {
          id: 'a',
          archivedAt: null,
          source: 'LinkedIn',
          workMode: 'remote',
          benefits: ' Buoni pasto ',
          applicationCount: 1,
        },
        {
          id: 'b',
          archivedAt: null,
          source: null,
          workMode: null,
          benefits: '  ',
          applicationCount: 0,
        },
        {
          id: 'c',
          archivedAt: 1,
          source: 'Sito',
          workMode: 'hybrid',
          benefits: 'Auto',
          applicationCount: 1,
        },
        {
          id: 'd',
          archivedAt: null,
          source: null,
          workMode: null,
          benefits: null,
          applicationCount: 0,
        },
      ],
    }),
  );
  expect(r.benefitsRecorded).toBe(1);
  expect(r.totals.opportunities).toBe(3);
  expect(r.sources).toEqual([{ source: 'LinkedIn', count: 1 }]);
  expect(r.workModes).toEqual([{ workMode: 'remote', count: 1 }]);
});
