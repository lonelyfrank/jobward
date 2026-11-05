import {
  columnResponse,
  deleteColumnInput,
  deletedResponse,
  moveInput,
  updateColumnInput,
} from '@jobward/schemas';
import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { parseJsonBody } from '../../lib/validate';
import { idParam, workspaceScope } from '../../middleware/workspace';
import { deleteColumn, moveColumn, updateColumn } from '../../services/columns';

export const columnRoutes = new Hono<AppEnv>()
  .use('*', workspaceScope)

  .patch('/:id', async (c) => {
    const input = await parseJsonBody(c, updateColumnInput);
    const column = await updateColumn(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(columnResponse.parse({ column }));
  })

  .post('/:id/move', async (c) => {
    const { afterId } = await parseJsonBody(c, moveInput);
    const column = await moveColumn(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      afterId,
      Date.now(),
    );
    return c.json(columnResponse.parse({ column }));
  })

  .delete('/:id', async (c) => {
    const { moveCardsToColumnId } = await parseJsonBody(c, deleteColumnInput);
    const id = idParam(c);
    await deleteColumn(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      id,
      moveCardsToColumnId,
      Date.now(),
    );
    return c.json(deletedResponse.parse({ id }));
  });
