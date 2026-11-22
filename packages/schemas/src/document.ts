import { DOCUMENT_KINDS, LIMITS } from '@jobward/shared';
import { z } from 'zod';
import { clientIdSchema, httpUrl, idSchema, optionalText, requiredText } from './primitives';

/** Riferimenti documentali (M3-C2, D3): si conserva il riferimento, mai il file; l'URL non si apre dal server. */
const emptyToNull = (v: string | null) => (v === '' ? null : v);
const fields = {
  title: requiredText(LIMITS.titleMax),
  kind: z.enum(DOCUMENT_KINDS),
  url: httpUrl.nullable(),
  note: optionalText(LIMITS.documentNoteMax).transform(emptyToNull),
};

export const createDocumentInput = z
  .object({
    id: clientIdSchema,
    title: fields.title,
    kind: fields.kind.default('other'),
    url: fields.url.optional(),
    note: fields.note.optional(),
  })
  .strict();
export type CreateDocumentInput = z.infer<typeof createDocumentInput>;

/** Assente = invariato, `null` = azzera (url, nota). */
export const updateDocumentInput = z
  .object({ title: fields.title, kind: fields.kind, url: fields.url, note: fields.note })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nessuna modifica indicata');
export type UpdateDocumentInput = z.infer<typeof updateDocumentInput>;

export const documentSchema = z.object({
  id: idSchema,
  cardId: idSchema,
  title: z.string(),
  kind: z.enum(DOCUMENT_KINDS),
  url: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type CardDocument = z.infer<typeof documentSchema>;
export const documentResponse = z.object({ document: documentSchema });
export const documentsResponse = z.object({ documents: z.array(documentSchema) });
