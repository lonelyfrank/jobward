import { noteResponse, updateNoteInput } from '@jobward/schemas';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../env';
import { parseJsonBody } from '../../lib/validate';
import { idParam, workspaceScope } from '../../middleware/workspace';
import { deleteNote, updateNote } from '../../services/notes';

/** Rotte per ID di una nota. Elenco e creazione stanno sotto `/cards/:id/notes`. */
export const noteRoutes = new Hono<AppEnv>()
  .use('*', workspaceScope)

  .patch('/:id', async (c) => {
    const input = await parseJsonBody(c, updateNoteInput);
    const note = await updateNote(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(noteResponse.parse({ note }));
  })

  .delete('/:id', async (c) => {
    await parseJsonBody(c, z.object({}).strict());
    await deleteNote(c.env.DB, c.get('db'), c.get('workspaceId'), idParam(c), Date.now());
    return c.body(null, 204);
  });
