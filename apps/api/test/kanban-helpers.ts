import { createApp } from '../src/app';
import { call, devEnv, seedWorkspace } from './helpers';

const app = createApp();

/** Client di test per un utente di sviluppo e il suo workspace (creato direttamente nel DB). */
export async function newUser(email: string) {
  const { workspaceId, userId } = await seedWorkspace(email);
  return { email, workspaceId, userId, api: clientFor(email, workspaceId) };
}

export function clientFor(email: string, workspaceId: string) {
  const env = devEnv(email);
  const url = (path: string) =>
    `/api/v1${path}${path.includes('?') ? '&' : '?'}workspaceId=${encodeURIComponent(workspaceId)}`;
  // Le richieste che modificano dati richiedono un corpo JSON (protezione CSRF): `{}` se vuoto.
  const send = (method: string, path: string, json: unknown = {}) =>
    call<any>(app, env, url(path), { method, json });
  return {
    get: (path: string) => call<any>(app, env, url(path)),
    post: (path: string, json?: unknown) => send('POST', path, json),
    patch: (path: string, json: unknown) => send('PATCH', path, json),
    put: (path: string, json: unknown) => send('PUT', path, json),
    delete: (path: string, json?: unknown) => send('DELETE', path, json),
  };
}

export type Api = ReturnType<typeof clientFor>;

/** Crea una bacheca (Minimal: 3 colonne) e restituisce i suoi identificativi. */
export async function createMinimalBoard(api: Api, name = 'Bacheca') {
  const res = await api.post('/boards', { name, templateId: 'minimal' });
  if (res.status !== 201) throw new Error(`creazione bacheca fallita: ${JSON.stringify(res.body)}`);
  const columns = res.body.columns as { id: string; name: string }[];
  return { boardId: res.body.board.id as string, columns, columnIds: columns.map((c) => c.id) };
}

export async function addCard(api: Api, columnId: string, title: string, extra: object = {}) {
  const res = await api.post('/cards', { columnId, title, ...extra });
  if (res.status !== 201) throw new Error(`creazione scheda fallita: ${JSON.stringify(res.body)}`);
  return res.body.card as { id: string; position: number; columnId: string; title: string };
}

/** Titoli delle schede attive di una colonna, nell'ordine mostrato dall'interfaccia. */
export async function columnTitles(api: Api, boardId: string, columnId: string) {
  const res = await api.get(`/boards/${boardId}`);
  return (res.body.cards as { columnId: string; title: string }[])
    .filter((c) => c.columnId === columnId)
    .map((c) => c.title);
}
