import {
  INTERVIEW_MODALITIES,
  INTERVIEW_RESULTS,
  INTERVIEW_STATUSES,
  INTERVIEW_TYPES,
  LIMITS,
} from '@jobward/shared';
import { z } from 'zod';
import { httpUrl, idSchema, optionalText, requiredText, timezoneSchema } from './primitives';

/**
 * Colloqui (M2.5). Contratti `strict`. STATO (organizzativo) ed ESITO (del colloquio) sono separati;
 * l'esito generale della candidatura (`outcome` della scheda) non dipende mai da questi.
 */

/** Istante in millisecondi UTC, in un intervallo ragionevole (2000–2100). */
const instantMs = z.number().int().min(946_684_800_000).max(4_102_444_800_000);

const interviewer = z.string().trim().min(1).max(LIMITS.nameMax);
const interviewers = z.array(interviewer).max(LIMITS.interviewersMax);

const fields = {
  title: requiredText(LIMITS.nameMax),
  type: z.enum(INTERVIEW_TYPES),
  /** `null` = da programmare. */
  scheduledAt: instantMs.nullable(),
  /** Fuso IANA in cui l'utente ha inserito la data; se manca vale quello del workspace. */
  timezone: timezoneSchema,
  durationMinutes: z.number().int().min(1).max(1440).nullable(),
  modality: z.enum(INTERVIEW_MODALITIES).nullable(),
  location: optionalText(LIMITS.nameMax),
  meetingUrl: httpUrl.nullable(),
  interviewers,
  preparationNotes: optionalText(LIMITS.descriptionMax),
};

const emptyToNull = (v: string | null) => (v === '' ? null : v);

export const createInterviewInput = z
  .object({
    title: fields.title.optional(),
    type: fields.type.default('other'),
    scheduledAt: fields.scheduledAt.optional(),
    timezone: fields.timezone.optional(),
    durationMinutes: fields.durationMinutes.optional(),
    modality: fields.modality.optional(),
    location: fields.location.transform(emptyToNull).optional(),
    meetingUrl: fields.meetingUrl.optional(),
    interviewers: fields.interviewers.default([]),
    preparationNotes: fields.preparationNotes.transform(emptyToNull).optional(),
    /** Round da cui questo prosegue («fase successiva»): stessa scheda. */
    followUpOf: idSchema.optional(),
  })
  .strict();
export type CreateInterviewInput = z.infer<typeof createInterviewInput>;

/** Assente = invariato, `null` = azzera. Le regole di stato sono del servizio. */
export const updateInterviewInput = z
  .object({
    title: fields.title,
    type: fields.type,
    scheduledAt: fields.scheduledAt,
    timezone: fields.timezone,
    durationMinutes: fields.durationMinutes,
    modality: fields.modality,
    location: fields.location.transform(emptyToNull),
    meetingUrl: fields.meetingUrl,
    interviewers: fields.interviewers,
    preparationNotes: fields.preparationNotes.transform(emptyToNull),
    feedbackNotes: optionalText(LIMITS.descriptionMax).transform(emptyToNull),
    result: z.enum(INTERVIEW_RESULTS).nullable(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nessuna modifica indicata');
export type UpdateInterviewInput = z.infer<typeof updateInterviewInput>;

export const completeInterviewInput = z
  .object({
    result: z.enum(INTERVIEW_RESULTS).nullable().optional(),
    feedbackNotes: optionalText(LIMITS.descriptionMax).transform(emptyToNull).optional(),
    /** Quando si è svolto; se manca vale «adesso». */
    completedAt: instantMs.optional(),
  })
  .strict();
export type CompleteInterviewInput = z.infer<typeof completeInterviewInput>;

export const cancelInterviewInput = z.object({}).strict();

export const interviewSchema = z.object({
  id: idSchema,
  cardId: idSchema,
  sequence: z.number().int().min(1),
  title: z.string(),
  type: z.enum(INTERVIEW_TYPES),
  status: z.enum(INTERVIEW_STATUSES),
  scheduledAt: z.number().int().nullable(),
  timezone: z.string().nullable(),
  durationMinutes: z.number().int().nullable(),
  modality: z.enum(INTERVIEW_MODALITIES).nullable(),
  location: z.string().nullable(),
  meetingUrl: z.string().nullable(),
  interviewers: z.array(z.string()),
  preparationNotes: z.string().nullable(),
  feedbackNotes: z.string().nullable(),
  result: z.enum(INTERVIEW_RESULTS).nullable(),
  completedAt: z.number().int().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Interview = z.infer<typeof interviewSchema>;

export const interviewResponse = z.object({ interview: interviewSchema });
export const interviewsResponse = z.object({ interviews: z.array(interviewSchema) });

/**
 * Proiezione leggera per Kanban, tabella e riepilogo (nessuna nota): calcolata dal server, in UNA
 * query per bacheca/pagina. Contiene solo dati registrati.
 *  - `next`: il primo colloquio programmato non ancora trascorso;
 *  - `action`: la prossima azione che DISCENDE dai dati (mai inventata), in quest'ordine:
 *    `overdue` (programmato ma la data è passata: aggiornalo), `record_feedback` (completato senza
 *    feedback né esito), `schedule` (da programmare).
 */
export const interviewSummarySchema = z.object({
  /** Round non annullati. */
  total: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  next: z
    .object({
      id: idSchema,
      sequence: z.number().int(),
      title: z.string(),
      type: z.enum(INTERVIEW_TYPES),
      scheduledAt: z.number().int(),
      timezone: z.string().nullable(),
      modality: z.enum(INTERVIEW_MODALITIES).nullable(),
    })
    .nullable(),
  action: z
    .object({
      kind: z.enum(['overdue', 'record_feedback', 'schedule']),
      interviewId: idSchema,
      sequence: z.number().int(),
      title: z.string(),
    })
    .nullable(),
});
export type InterviewSummary = z.infer<typeof interviewSummarySchema>;

export const EMPTY_INTERVIEW_SUMMARY: InterviewSummary = {
  total: 0,
  completed: 0,
  next: null,
  action: null,
};

/** Riga minima da cui si calcola il riepilogo (nessuna nota). */
export interface InterviewSummaryRow {
  id: string;
  sequence: number;
  title: string;
  type: (typeof INTERVIEW_TYPES)[number];
  status: (typeof INTERVIEW_STATUSES)[number];
  scheduledAt: number | null;
  timezone: string | null;
  modality: (typeof INTERVIEW_MODALITIES)[number] | null;
  hasFeedback: boolean;
}

/** Regole del riepilogo in una funzione pura: stesse per server, test e (se serve) client. */
export function summarizeInterviews(rows: InterviewSummaryRow[], now: number): InterviewSummary {
  const live = rows.filter((r) => r.status !== 'cancelled');
  const bySeq = [...live].sort((a, b) => a.sequence - b.sequence);
  const upcoming = bySeq
    .filter((r) => r.status === 'scheduled' && r.scheduledAt !== null && r.scheduledAt >= now)
    .sort(
      (a, b) => (a.scheduledAt as number) - (b.scheduledAt as number) || a.sequence - b.sequence,
    )[0];
  const overdue = bySeq.find(
    (r) => r.status === 'scheduled' && r.scheduledAt !== null && r.scheduledAt < now,
  );
  const missingFeedback = [...bySeq]
    .reverse()
    .find((r) => r.status === 'completed' && !r.hasFeedback);
  const toSchedule = bySeq.find((r) => r.status === 'to_schedule');
  const pick = overdue
    ? ({ kind: 'overdue', row: overdue } as const)
    : missingFeedback
      ? ({ kind: 'record_feedback', row: missingFeedback } as const)
      : toSchedule
        ? ({ kind: 'schedule', row: toSchedule } as const)
        : null;
  return {
    total: live.length,
    completed: live.filter((r) => r.status === 'completed').length,
    next: upcoming
      ? {
          id: upcoming.id,
          sequence: upcoming.sequence,
          title: upcoming.title,
          type: upcoming.type,
          scheduledAt: upcoming.scheduledAt as number,
          timezone: upcoming.timezone,
          modality: upcoming.modality,
        }
      : null,
    action: pick
      ? {
          kind: pick.kind,
          interviewId: pick.row.id,
          sequence: pick.row.sequence,
          title: pick.row.title,
        }
      : null,
  };
}
