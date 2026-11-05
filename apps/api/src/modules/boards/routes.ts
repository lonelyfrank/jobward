import {
  archivedCardsResponse,
  boardCreatedResponse,
  boardDetailResponse,
  boardResponse,
  boardsResponse,
  columnResponse,
  createBoardInput,
  createColumnInput,
  createCustomFieldInput,
  customFieldResponse,
  customFieldsResponse,
  deletedResponse,
  moveInput,
  updateBoardInput,
} from '@meet-roulette/schemas';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../env';
import { parseJsonBody } from '../../lib/validate';
import { idParam, workspaceScope } from '../../middleware/workspace';
import {
  createBoard,
  deleteBoard,
  getBoard,
  listBoards,
  moveBoard,
  updateBoard,
} from '../../services/boards';
import { listActiveCards, listArchivedCards } from '../../services/cards';
import { createColumn, listColumns } from '../../services/columns';
import { createField, listFields } from '../../services/custom-fields';

const emptyObject = z.object({}).strict();

/** Contratti validati in uscita con gli stessi schemi usati dal client. */
export const boardRoutes = new Hono<AppEnv>()
  .use('*', workspaceScope)

  .get('/', async (c) => {
    const boards = await listBoards(c.get('db'), c.get('workspaceId'));
    return c.json(boardsResponse.parse({ boards }));
  })

  .post('/', async (c) => {
    const input = await parseJsonBody(c, createBoardInput);
    const created = await createBoard(c.env.DB, c.get('workspaceId'), input, Date.now());
    return c.json(boardCreatedResponse.parse(created), 201);
  })

  .get('/:id', async (c) => {
    const db = c.get('db');
    const workspaceId = c.get('workspaceId');
    const boardId = idParam(c);
    const board = await getBoard(db, workspaceId, boardId);
    const [columns, cards] = await Promise.all([
      listColumns(db, workspaceId, boardId),
      listActiveCards(db, workspaceId, boardId),
    ]);
    return c.json(boardDetailResponse.parse({ board, columns, cards }));
  })

  .get('/:id/custom-fields', async (c) => {
    const fields = await listFields(c.get('db'), c.get('workspaceId'), idParam(c));
    return c.json(customFieldsResponse.parse({ fields }));
  })

  .post('/:id/custom-fields', async (c) => {
    const input = await parseJsonBody(c, createCustomFieldInput);
    const field = await createField(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(customFieldResponse.parse({ field }), 201);
  })

  .patch('/:id', async (c) => {
    const input = await parseJsonBody(c, updateBoardInput);
    const board = await updateBoard(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(boardResponse.parse({ board }));
  })

  .delete('/:id', async (c) => {
    await parseJsonBody(c, emptyObject); // il corpo JSON è richiesto dalla protezione CSRF
    const id = idParam(c);
    await deleteBoard(c.env.DB, c.get('workspaceId'), id);
    return c.json(deletedResponse.parse({ id }));
  })

  .post('/:id/move', async (c) => {
    const { afterId } = await parseJsonBody(c, moveInput);
    const board = await moveBoard(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      afterId,
      Date.now(),
    );
    return c.json(boardResponse.parse({ board }));
  })

  .get('/:id/archived', async (c) => {
    const cards = await listArchivedCards(c.get('db'), c.get('workspaceId'), idParam(c));
    return c.json(archivedCardsResponse.parse({ cards }));
  })

  .post('/:id/columns', async (c) => {
    const input = await parseJsonBody(c, createColumnInput);
    const column = await createColumn(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(columnResponse.parse({ column }), 201);
  });
