import { BOARD_TEMPLATE_IDS, LIMITS, STAGES } from '@jobward/shared';
import { z } from 'zod';
import { colorToken, idSchema, optionalText, requiredText } from './primitives';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** Catalogo chiuso di immagini ospitate dall'app: nessun URL esterno o upload. */
export const BOARD_BACKGROUND_IMAGES = [
  'golden-coast',
  'alps',
  'misty-fjord',
  'misty-forest',
  'sunny-meadow',
  'dunes',
  'ocean',
  'lake',
] as const;
export const boardBackgroundImage = z.enum(BOARD_BACKGROUND_IMAGES);
export type BoardBackgroundImage = z.infer<typeof boardBackgroundImage>;

export const createBoardInput = z.object({
  name: requiredText(LIMITS.nameMax),
  description: optionalText(LIMITS.shortTextMax).default(null),
  icon: z.string().trim().max(40).nullable().default(null),
  color: colorToken.nullable().default(null),
  backgroundImage: boardBackgroundImage.nullable().default(null),
  /** Template di partenza: bacheca e colonne vengono create insieme, in modo atomico. */
  templateId: z.enum(BOARD_TEMPLATE_IDS).default('custom'),
});
export type CreateBoardInput = z.infer<typeof createBoardInput>;

/** Modifica parziale: almeno un campo. */
export const updateBoardInput = z
  .object({
    name: requiredText(LIMITS.nameMax),
    description: optionalText(LIMITS.shortTextMax),
    color: colorToken.nullable(),
    backgroundImage: boardBackgroundImage.nullable(),
    isFavorite: z.boolean(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nessuna modifica indicata');
export type UpdateBoardInput = z.infer<typeof updateBoardInput>;

export const createColumnInput = z.object({
  name: requiredText(LIMITS.nameMax),
  color: colorToken.nullable().default(null),
  category: z.enum(STAGES).nullable().default(null),
});
export type CreateColumnInput = z.infer<typeof createColumnInput>;

export const updateColumnInput = z
  .object({
    name: requiredText(LIMITS.nameMax),
    color: colorToken.nullable(),
    category: z.enum(STAGES).nullable(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nessuna modifica indicata');
export type UpdateColumnInput = z.infer<typeof updateColumnInput>;

/**
 * Riordino di bacheche e colonne: l'elemento va collocato subito DOPO `afterId`
 * (`null` = in prima posizione). Si indica un vicino, non un indice: resta corretto anche se
 * la lista è cambiata nel frattempo (in tal caso l'API risponde 409).
 */
export const moveInput = z.object({ afterId: idSchema.nullable() }).strict();
export type MoveInput = z.infer<typeof moveInput>;

/** Eliminazione colonna: le schede, se presenti, vanno prima spostate in un'altra colonna. */
export const deleteColumnInput = z
  .object({ moveCardsToColumnId: idSchema.nullable().default(null) })
  .strict();
export type DeleteColumnInput = z.infer<typeof deleteColumnInput>;

// ---------------------------------------------------------------------------
// Risposte
// ---------------------------------------------------------------------------

export const boardSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  backgroundImage: z.string().nullable().default(null),
  position: z.number().int(),
  isFavorite: z.boolean(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Board = z.infer<typeof boardSchema>;

/** Bacheca con i conteggi mostrati nella galleria (solo schede non archiviate). */
export const boardListItemSchema = boardSchema.extend({
  columnCount: z.number().int(),
  cardCount: z.number().int(),
});
export type BoardListItem = z.infer<typeof boardListItemSchema>;

export const columnSchema = z.object({
  id: idSchema,
  boardId: idSchema,
  name: z.string(),
  color: z.string().nullable(),
  category: z.enum(STAGES).nullable(),
  position: z.number().int(),
  /** Schede attive (non archiviate). */
  cardCount: z.number().int(),
  /** Schede archiviate che occupano ancora la colonna. */
  archivedCount: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Column = z.infer<typeof columnSchema>;

export const boardsResponse = z.object({ boards: z.array(boardListItemSchema) });
export const boardCreatedResponse = z.object({
  board: boardSchema,
  columns: z.array(columnSchema),
});
export const boardResponse = z.object({ board: boardSchema });
export const columnResponse = z.object({ column: columnSchema });
export const deletedResponse = z.object({ id: idSchema });

export const boardSummarySchema = z.object({
  id: idSchema,
  name: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  updatedAt: z.number().int(),
});
export type BoardSummary = z.infer<typeof boardSummarySchema>;
