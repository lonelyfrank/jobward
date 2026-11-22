import { z } from 'zod';
import { calendarDate, idSchema } from './primitives';

export const CALENDAR_KINDS = ['interview', 'task', 'deadline'] as const;
export type CalendarKind = (typeof CALENDAR_KINDS)[number];

/** Intervallo richiesto: date di calendario incluse, al massimo 62 giorni (un mese visibile + bordi). */
export const calendarQuery = z
  .object({ from: calendarDate, to: calendarDate })
  .strict()
  .refine((q) => q.from <= q.to, {
    path: ['to'],
    message: 'La data finale precede quella iniziale',
  })
  .refine(
    (q) => (Date.parse(`${q.to}T00:00:00Z`) - Date.parse(`${q.from}T00:00:00Z`)) / 86_400_000 <= 62,
    { path: ['to'], message: 'Intervallo massimo: 62 giorni' },
  );
export type CalendarQuery = z.infer<typeof calendarQuery>;

export const calendarItemSchema = z.object({
  kind: z.enum(CALENDAR_KINDS),
  id: idSchema,
  /** Giorno nel fuso del workspace. */
  date: calendarDate,
  /** Istante preciso (solo colloqui programmati). */
  at: z.number().int().nullable(),
  title: z.string(),
  status: z.string().nullable(),
  cardId: idSchema.nullable(),
  cardTitle: z.string().nullable(),
  boardId: idSchema.nullable(),
});
export type CalendarItem = z.infer<typeof calendarItemSchema>;

export const calendarResponse = z.object({
  timeZone: z.string(),
  items: z.array(calendarItemSchema),
});
export type CalendarResponse = z.infer<typeof calendarResponse>;
