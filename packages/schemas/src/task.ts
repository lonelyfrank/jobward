import {
  isCalendarDate,
  LIMITS,
  PRIORITIES,
  TASK_KINDS,
  TASK_STATUSES,
  TASK_VIEWS,
} from '@jobward/shared';
import { z } from 'zod';
import { calendarDate, idSchema, optionalText, requiredText } from './primitives';

/**
 * Attività (M3 Tasks, docs/m3/tasks-api-contracts.md). La scadenza è una DATA di calendario nel fuso
 * del workspace (nessun orario). Lo stato è DERIVATO dai timestamp e non è scrivibile: si cambia con
 * i comandi complete / reopen / cancel.
 */

/** ID del client (UUID): ≤ 48 caratteri perché la Timeline ne deriva id di voce con un suffisso. */
export const taskClientIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{16,48}$/, 'Identificativo non valido');

export const dueOnSchema = calendarDate.refine(isCalendarDate, 'Data non valida');
export const taskKindSchema = z.enum(TASK_KINDS);
export const taskStatusSchema = z.enum(TASK_STATUSES);

export const createTaskInput = z
  .object({
    id: taskClientIdSchema,
    title: requiredText(LIMITS.titleMax),
    description: optionalText(LIMITS.taskDescriptionMax).optional(),
    kind: taskKindSchema.default('general'),
    priority: z.enum(PRIORITIES).default('none'),
    dueOn: dueOnSchema.nullable().optional(),
    cardId: idSchema.nullable().optional(),
  })
  .strict();
export type CreateTaskInput = z.infer<typeof createTaskInput>;

export const updateTaskInput = z
  .object({
    /** Compare-and-swap: `updatedAt` della versione che l'utente sta modificando. */
    expectedUpdatedAt: z.number().int().positive(),
    title: requiredText(LIMITS.titleMax).optional(),
    description: optionalText(LIMITS.taskDescriptionMax).optional(),
    kind: taskKindSchema.optional(),
    priority: z.enum(PRIORITIES).optional(),
    dueOn: dueOnSchema.nullable().optional(),
    cardId: idSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (v) =>
      Object.keys(v).some((k) => k !== 'expectedUpdatedAt' && v[k as keyof typeof v] !== undefined),
    { message: 'Indica almeno un campo da modificare' },
  );
export type UpdateTaskInput = z.infer<typeof updateTaskInput>;

/** I comandi di stato non hanno corpo. */
export const taskCommandInput = z.object({}).strict();

export const tasksQuery = z.object({
  view: z.enum(TASK_VIEWS).default('all'),
  cardId: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(LIMITS.taskPageMax).default(LIMITS.taskPageDefault),
  cursor: z.string().min(1).max(300).optional(),
});
export type TasksQuery = z.infer<typeof tasksQuery>;

export const taskCardSummarySchema = z.object({
  id: idSchema,
  boardId: idSchema,
  title: z.string(),
  company: z.string().nullable(),
  archived: z.boolean(),
});
export type TaskCardSummary = z.infer<typeof taskCardSummarySchema>;

export const taskSchema = z.object({
  id: idSchema,
  cardId: idSchema.nullable(),
  card: taskCardSummarySchema.nullable(),
  title: z.string(),
  description: z.string().nullable(),
  kind: taskKindSchema,
  priority: z.enum(PRIORITIES),
  dueOn: z.string().nullable(),
  status: taskStatusSchema,
  completedAt: z.number().int().nullable(),
  cancelledAt: z.number().int().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Task = z.infer<typeof taskSchema>;

/** Data locale e fuso del workspace usati dal SERVER per questa risposta (riproducibile). */
export const taskAsOfSchema = z.object({ today: z.string(), timeZone: z.string() });
export type TaskAsOf = z.infer<typeof taskAsOfSchema>;

export const taskResponse = z.object({ task: taskSchema, asOf: taskAsOfSchema });
export const tasksResponse = z.object({
  tasks: z.array(taskSchema),
  nextCursor: z.string().nullable(),
  asOf: taskAsOfSchema,
});
export const taskCountsSchema = z.object({
  open: z.number().int(),
  today: z.number().int(),
  overdue: z.number().int(),
  noDue: z.number().int(),
  done: z.number().int(),
});
export const taskSummaryResponse = z.object({ asOf: taskAsOfSchema, counts: taskCountsSchema });
export type TaskSummaryResponse = z.infer<typeof taskSummaryResponse>;
export type TasksResponse = z.infer<typeof tasksResponse>;
