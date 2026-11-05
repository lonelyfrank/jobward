import {
  customFieldResponse,
  deleteCustomFieldInput,
  deletedResponse,
  moveInput,
  updateCustomFieldInput,
} from '@jobward/schemas';
import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { parseJsonBody } from '../../lib/validate';
import { idParam, workspaceScope } from '../../middleware/workspace';
import { deleteField, moveField, updateField } from '../../services/custom-fields';

/**
 * Rotte per ID di un campo personalizzato. L'elenco e la creazione (per bacheca) stanno in
 * `/boards/:id/custom-fields`, i valori (per scheda) in `/cards/:id/custom-fields`.
 */
export const customFieldRoutes = new Hono<AppEnv>()
  .use('*', workspaceScope)

  .patch('/:id', async (c) => {
    const input = await parseJsonBody(c, updateCustomFieldInput);
    const field = await updateField(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(customFieldResponse.parse({ field }));
  })

  .post('/:id/move', async (c) => {
    const { afterId } = await parseJsonBody(c, moveInput);
    const field = await moveField(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      afterId,
      Date.now(),
    );
    return c.json(customFieldResponse.parse({ field }));
  })

  .delete('/:id', async (c) => {
    const { deleteValues } = await parseJsonBody(c, deleteCustomFieldInput);
    const id = idParam(c);
    await deleteField(c.env.DB, c.get('db'), c.get('workspaceId'), id, deleteValues);
    return c.json(deletedResponse.parse({ id }));
  });
