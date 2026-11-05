import {
  assignLabelInput,
  cardCustomFieldResponse,
  cardCustomFieldsResponse,
  cardDetailResponse,
  cardLabelsResponse,
  cardResponse,
  createCardInput,
  createInterviewInput,
  interviewResponse,
  interviewsResponse,
  moveCardInput,
  putCustomFieldValueInput,
  updateCardInput,
} from '@jobward/schemas';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../env';
import { parseJsonBody } from '../../lib/validate';
import { idParam, workspaceScope } from '../../middleware/workspace';
import { createInterview, listInterviews } from '../../services/interviews';
import { listCardFields, putCardFieldValue } from '../../services/custom-fields';
import { assignLabel, unassignLabel } from '../../services/labels';
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
  })

  .get('/:id/custom-fields', async (c) => {
    const fields = await listCardFields(c.get('db'), c.get('workspaceId'), idParam(c));
    return c.json(cardCustomFieldsResponse.parse({ fields }));
  })

  .put('/:id/custom-fields/:fieldId', async (c) => {
    const { value } = await parseJsonBody(c, putCustomFieldValueInput);
    const field = await putCardFieldValue(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      idParam(c, 'fieldId'),
      value,
      Date.now(),
    );
    return c.json(cardCustomFieldResponse.parse({ field }));
  })

  .post('/:id/labels', async (c) => {
    const { labelId } = await parseJsonBody(c, assignLabelInput);
    const labelIds = await assignLabel(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      labelId,
      Date.now(),
    );
    return c.json(cardLabelsResponse.parse({ labelIds }));
  })

  .delete('/:id/labels/:labelId', async (c) => {
    await parseJsonBody(c, emptyObject);
    const labelIds = await unassignLabel(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      idParam(c, 'labelId'),
      Date.now(),
    );
    return c.json(cardLabelsResponse.parse({ labelIds }));
  })
  .get('/:id/interviews', async (c) => {
    const interviews = await listInterviews(c.get('db'), c.get('workspaceId'), idParam(c));
    return c.json(interviewsResponse.parse({ interviews }));
  })

  .post('/:id/interviews', async (c) => {
    const input = await parseJsonBody(c, createInterviewInput);
    const interview = await createInterview(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      c.get('user').id,
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(interviewResponse.parse({ interview }), 201);
  });
