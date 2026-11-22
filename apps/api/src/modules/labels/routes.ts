import {
  createLabelInput,
  deletedResponse,
  deleteLabelInput,
  labelResponse,
  labelsResponse,
  updateLabelInput,
} from '@jobward/schemas';
import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { parseJsonBody } from '../../lib/validate';
import { idParam, workspaceScope } from '../../middleware/workspace';
import { createLabel, deleteLabel, listLabels, updateLabel } from '../../services/labels';

export const labelRoutes = new Hono<AppEnv>()
  .use('*', workspaceScope)

  .get('/', async (c) => {
    const labels = await listLabels(c.get('db'), c.get('workspaceId'));
    return c.json(labelsResponse.parse({ labels }));
  })

  .post('/', async (c) => {
    const input = await parseJsonBody(c, createLabelInput);
    const label = await createLabel(c.env.DB, c.get('db'), c.get('workspaceId'), input, Date.now());
    return c.json(labelResponse.parse({ label }), 201);
  })

  .patch('/:id', async (c) => {
    const input = await parseJsonBody(c, updateLabelInput);
    const label = await updateLabel(c.env.DB, c.get('db'), c.get('workspaceId'), idParam(c), input);
    return c.json(labelResponse.parse({ label }));
  })

  .delete('/:id', async (c) => {
    const { force } = await parseJsonBody(c, deleteLabelInput);
    const id = idParam(c);
    await deleteLabel(c.env.DB, c.get('db'), c.get('workspaceId'), id, force);
    return c.json(deletedResponse.parse({ id }));
  });
