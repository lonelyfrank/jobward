import { documentResponse, updateDocumentInput } from '@jobward/schemas';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../env';
import { parseJsonBody } from '../../lib/validate';
import { idParam, workspaceScope } from '../../middleware/workspace';
import { deleteDocument, updateDocument } from '../../services/documents';

/** Rotte per ID di un riferimento documentale. Elenco e creazione stanno sotto `/cards/:id/documents`. */
export const documentRoutes = new Hono<AppEnv>()
  .use('*', workspaceScope)

  .patch('/:id', async (c) => {
    const input = await parseJsonBody(c, updateDocumentInput);
    const document = await updateDocument(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(documentResponse.parse({ document }));
  })

  .delete('/:id', async (c) => {
    await parseJsonBody(c, z.object({}).strict());
    await deleteDocument(c.env.DB, c.get('db'), c.get('workspaceId'), idParam(c), Date.now());
    return c.body(null, 204);
  });
