import {
  assignLabelInput,
  cardCustomFieldResponse,
  cardCustomFieldsResponse,
  cardDetailResponse,
  cardLabelsResponse,
  cardResponse,
  createCardInput,
  createDocumentInput,
  createInterviewInput,
  createNoteInput,
  documentResponse,
  documentsResponse,
  interviewResponse,
  interviewsResponse,
  moveCardInput,
  noteResponse,
  notesResponse,
  notesQuery,
  notesPageResponse,
  pipelineTransitionInput,
  pipelineTransitionResponse,
  putCustomFieldValueInput,
  timelineQuery,
  timelineResponse,
  updateCardInput,
} from '@jobward/schemas';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../env';
import { parseJsonBody, parseQuery } from '../../lib/validate';
import { idParam, workspaceScope } from '../../middleware/workspace';
import { createDocument, listDocuments } from '../../services/documents';
import { createInterview, listInterviews } from '../../services/interviews';
import { createNote, listNotes, listNotesPage } from '../../services/notes';
import { transitionCard } from '../../services/pipeline';
import { getTimeline } from '../../services/timeline';
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
    const { interview, replayed } = await createInterview(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      c.get('user').id,
      idParam(c),
      input,
      Date.now(),
    );
    // 201 alla prima creazione, 200 al replay della stessa richiesta (stessa identità, nessun evento).
    return c.json(interviewResponse.parse({ interview }), replayed ? 200 : 201);
  })

  // --- M3-C2: pipeline, note, documenti, timeline -------------------------------------------------
  .post('/:id/pipeline', async (c) => {
    const input = await parseJsonBody(c, pipelineTransitionInput);
    const result = await transitionCard(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      c.get('user').id,
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(pipelineTransitionResponse.parse(result));
  })

  .get('/:id/timeline', async (c) => {
    const query = parseQuery(c, timelineQuery);
    const timeline = await getTimeline(c.get('db'), c.get('workspaceId'), idParam(c), query);
    return c.json(timelineResponse.parse(timeline));
  })

  .get('/:id/notes', async (c) => {
    const query = parseQuery(c, notesQuery);
    if (query.limit !== undefined || query.before !== undefined) {
      const page = await listNotesPage(c.get('db'), c.get('workspaceId'), idParam(c), query);
      return c.json(notesPageResponse.parse(page));
    }
    const notes = await listNotes(c.get('db'), c.get('workspaceId'), idParam(c));
    return c.json(notesResponse.parse({ notes }));
  })

  .post('/:id/notes', async (c) => {
    const input = await parseJsonBody(c, createNoteInput);
    const { note, replayed } = await createNote(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(noteResponse.parse({ note }), replayed ? 200 : 201);
  })

  .get('/:id/documents', async (c) => {
    const documents = await listDocuments(c.get('db'), c.get('workspaceId'), idParam(c));
    return c.json(documentsResponse.parse({ documents }));
  })

  .post('/:id/documents', async (c) => {
    const input = await parseJsonBody(c, createDocumentInput);
    const { document, replayed } = await createDocument(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(documentResponse.parse({ document }), replayed ? 200 : 201);
  });
