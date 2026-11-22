import { FUNNEL_STEPS, OUTCOMES, PIPELINE_STATUSES } from '@jobward/shared';
import { z } from 'zod';

const count = z.number().int().nonnegative();

/** Risposta di `GET /insights`: vedi `computeInsights` in `@jobward/shared` per le formule. */
export const insightsResponse = z.object({
  generatedAt: z.number().int(),
  timeZone: z.string(),
  totals: z.object({
    opportunities: count,
    inbox: count,
    applications: count,
    activeApplications: count,
    interviews: count,
    upcomingInterviews: count,
    offers: count,
    hired: count,
  }),
  statusDistribution: z.array(z.object({ status: z.enum(PIPELINE_STATUSES), count })),
  funnel: z.array(
    z.object({ step: z.enum(FUNNEL_STEPS), count, rate: z.number().min(0).nullable() }),
  ),
  outcomes: z.array(z.object({ outcome: z.enum(OUTCOMES), count })),
  responseTime: z.object({
    medianDays: z.number().int().nullable(),
    sampleSize: count,
    withoutAppliedOn: count,
    awaitingResponse: count,
  }),
  weekly: z.array(z.object({ weekStart: z.string(), count })),
  sources: z.array(z.object({ source: z.string(), count })),
  benefitsRecorded: count,
  workModes: z.array(z.object({ workMode: z.string(), count })),
});
export type InsightsResponse = z.infer<typeof insightsResponse>;
