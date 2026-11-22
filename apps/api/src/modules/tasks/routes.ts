import {
  createTaskInput,
  taskCommandInput,
  taskResponse,
  taskSummaryResponse,
  tasksQuery,
  tasksResponse,
  updateTaskInput,
} from '@jobward/schemas';
import { Hono, type Context } from 'hono';
import type { AppEnv } from '../../env';
import { parseJsonBody, parseQuery } from '../../lib/validate';
import { idParam, workspaceScope } from '../../middleware/workspace';
import {
  changeTaskState,
  createTask,
  getAsOf,
  getTask,
  getTaskSummary,
  listTasks,
  updateTask,
  type TaskCommand,
} from '../../services/tasks';

/**
 * Attività (M3 Tasks). Collezione di primo livello (non annidata sotto /cards: una task può non avere
 * una candidatura); l'elenco per card è il filtro `?cardId=`. Nessun DELETE: si annulla.
 * `/summary` va dichiarata PRIMA di `/:id`.
 */
async function runCommand(c: Context<AppEnv>, id: string, name: TaskCommand) {
  await parseJsonBody(c, taskCommandInput);
  const { task, asOf } = await changeTaskState(
    c.env.DB,
    c.get('db'),
    c.get('workspaceId'),
    id,
    name,
    Date.now(),
  );
  return c.json(taskResponse.parse({ task, asOf }));
}

export const taskRoutes = new Hono<AppEnv>()
  .use('*', workspaceScope)

  .get('/', async (c) => {
    const query = parseQuery(c, tasksQuery);
    const page = await listTasks(c.get('db'), c.get('workspaceId'), query, Date.now());
    return c.json(tasksResponse.parse(page));
  })

  .get('/summary', async (c) =>
    c.json(
      taskSummaryResponse.parse(
        await getTaskSummary(c.get('db'), c.get('workspaceId'), Date.now()),
      ),
    ),
  )

  .post('/', async (c) => {
    const input = await parseJsonBody(c, createTaskInput);
    const { task, replayed, asOf } = await createTask(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      input,
      Date.now(),
    );
    return c.json(taskResponse.parse({ task, asOf }), replayed ? 200 : 201);
  })

  .get('/:id', async (c) => {
    const workspaceId = c.get('workspaceId');
    const task = await getTask(c.get('db'), workspaceId, idParam(c));
    const asOf = await getAsOf(c.get('db'), workspaceId, Date.now());
    return c.json(taskResponse.parse({ task, asOf }));
  })

  .patch('/:id', async (c) => {
    const input = await parseJsonBody(c, updateTaskInput);
    const { task, asOf } = await updateTask(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(taskResponse.parse({ task, asOf }));
  })

  .post('/:id/complete', (c) => runCommand(c, idParam(c), 'complete'))
  .post('/:id/reopen', (c) => runCommand(c, idParam(c), 'reopen'))
  .post('/:id/cancel', (c) => runCommand(c, idParam(c), 'cancel'));
