import {
  cardDetailResponse,
  cardResponse,
  createCardInput,
  moveCardInput,
  updateCardInput,
} from '@meet-roulette/schemas';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../env';
import { parseJsonBody } from '../../lib/validate';
import { idParam, workspaceScope } from '../../middleware/workspace';
import {
  archiveCard,
  createCard,
  getCardDetail,
  moveCard,
  restoreCard,
  updateCard,
} from '../../services/cards';

const emptyObject = z.object({}).strict();

export const cardRoutes = new Hono<AppEnv>()
  .use('*', workspaceScope)

  .post('/', async (c) => {
    const input = await parseJsonBody(c, createCardInput);
    const card = await createCard(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      c.get('user').id,
      input,
      Date.now(),
    );
    return c.json(cardResponse.parse({ card }), 201);
  })

  .get('/:id', async (c) => {
    const detail = await getCardDetail(c.get('db'), c.get('workspaceId'), idParam(c));
    return c.json(cardDetailResponse.parse(detail));
  })

  .patch('/:id', async (c) => {
    const input = await parseJsonBody(c, updateCardInput);
    const card = await updateCard(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      c.get('user').id,
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(cardResponse.parse({ card }));
  })

  .post('/:id/move', async (c) => {
    const input = await parseJsonBody(c, moveCardInput);
    const card = await moveCard(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      c.get('user').id,
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(cardResponse.parse({ card }));
  })

  .post('/:id/archive', async (c) => {
    await parseJsonBody(c, emptyObject);
    const card = await archiveCard(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      c.get('user').id,
      idParam(c),
      Date.now(),
    );
    return c.json(cardResponse.parse({ card }));
  })

  .post('/:id/restore', async (c) => {
    await parseJsonBody(c, emptyObject);
    const card = await restoreCard(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      c.get('user').id,
      idParam(c),
      Date.now(),
    );
    return c.json(cardResponse.parse({ card }));
  });
