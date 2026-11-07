import { z } from 'zod';
import { boardSummarySchema } from './board';
import { idSchema } from './primitives';

export const overviewResponse = z.object({
  workspaceId: idSchema,
  counts: z.object({
    boards: z.number().int(),
    /** Schede non archiviate. */
    opportunities: z.number().int(),
    /** Schede con data di candidatura registrata. */
    applicationsSubmitted: z.number().int(),
    /** Schede attualmente nella fase "colloquio". */
    interviews: z.number().int(),
    openTasks: z.number().int(),
    overdueTasks: z.number().int(),
    /** Additivi (M3 Tasks): attività aperte in scadenza oggi e senza scadenza. */
    dueTodayTasks: z.number().int(),
    noDueTasks: z.number().int(),
  }),
  upcomingTasks: z.array(
    z.object({
      id: idSchema,
      title: z.string(),
      /**
       * Retrocompatibile: intero (ms UTC) = primo istante del giorno di scadenza nel fuso del
       * workspace. DEPRECATO come orario (la scadenza è una data): usare `dueOn`.
       */
      dueAt: z.number().int(),
      /** Additivo: la data di calendario `YYYY-MM-DD`. */
      dueOn: z.string(),
      cardId: idSchema.nullable(),
    }),
  ),
  recentBoards: z.array(boardSummarySchema),
  /** Schede attive modificate di recente, con bacheca e colonna in cui si trovano. */
  recentCards: z.array(
    z.object({
      id: idSchema,
      title: z.string(),
      boardId: idSchema,
      boardName: z.string(),
      columnName: z.string(),
      updatedAt: z.number().int(),
    }),
  ),
});
export type OverviewResponse = z.infer<typeof overviewResponse>;
