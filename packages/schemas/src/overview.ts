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
  }),
  upcomingTasks: z.array(
    z.object({
      id: idSchema,
      title: z.string(),
      dueAt: z.number().int(),
      cardId: idSchema.nullable(),
    }),
  ),
  recentBoards: z.array(boardSummarySchema),
});
export type OverviewResponse = z.infer<typeof overviewResponse>;
