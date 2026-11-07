import type { Card, Task } from '@jobward/schemas';
import { QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/app/providers';
import { NoticeProvider } from '@/components/ui/notices';
import { keys } from '@/features/boards/api';
import { DirtyGuardContext } from '@/features/cards/dirty-guard';
import { describeTimelineEntry } from '@/features/timeline/timeline-tab';
import { WorkspaceContext } from '@/features/workspace/context';
import { card } from '@/test/fixtures';
import { mockApi, renderApp, USER, WORKSPACE, withWorkspace } from '@/test/utils';
import { CardTasksSection } from './card-tasks-section';
import { describeDue } from './presentation';

const ASOF = { today: '2026-11-07', timeZone: 'Europe/Rome' };
const mk = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  cardId: null,
  card: null,
  title: `Attività ${id}`,
  description: null,
  kind: 'general',
  priority: 'none',
  dueOn: null,
  status: 'open',
  completedAt: null,
  cancelledAt: null,
  createdAt: 1_000,
  updatedAt: 5_000,
  ...over,
});
const failure = (status: number, message: string) => ({
  status,
  body: {
    error: { code: status === 409 ? 'conflict' : 'validation_error', message, requestId: 'r' },
  },
});

/** API simulata con le viste dell'elenco: filtra come il server (solo ciò che serve ai test). */
function tasksApi(
  initial: Task[],
  extra: Record<string, never> | Parameters<typeof mockApi>[0] = {},
) {
  const store = [...initial];
  const counts = () => ({
    open: store.filter((t) => t.status === 'open').length,
    today: store.filter((t) => t.status === 'open' && t.dueOn === ASOF.today).length,
    overdue: store.filter((t) => t.status === 'open' && t.dueOn !== null && t.dueOn < ASOF.today)
      .length,
    noDue: store.filter((t) => t.status === 'open' && t.dueOn === null).length,
    done: store.filter((t) => t.status === 'done').length,
  });
  return mockApi({
    ...withWorkspace(),
    'GET /tasks': ({ path }) => {
      const q = new URLSearchParams(path.split('?')[1]);
      const view = q.get('view') ?? 'all';
      const cardId = q.get('cardId');
      const pick = store.filter((t) => {
        if (cardId && t.cardId !== cardId) return false;
        if (view === 'open') return t.status === 'open';
        if (view === 'done') return t.status === 'done';
        if (view === 'cancelled') return t.status === 'cancelled';
        if (view === 'overdue')
          return t.status === 'open' && t.dueOn !== null && t.dueOn < ASOF.today;
        if (view === 'no_due') return t.status === 'open' && t.dueOn === null;
        return t.status !== 'cancelled';
      });
      return { body: { tasks: pick, nextCursor: null, asOf: ASOF } };
    },
    'GET /tasks/summary': () => ({ body: { asOf: ASOF, counts: counts() } }),
    ...(extra as Record<string, never>),
  });
}

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('pagina Attività', () => {
  const sample = [
    mk('t-over', { title: 'Richiama HR', dueOn: '2026-11-06', priority: 'high' }),
    mk('t-today', { title: 'Aggiorna il CV', dueOn: '2026-11-07' }),
    mk('t-soon', { title: 'Follow-up Beta', dueOn: '2026-11-09', kind: 'follow_up' }),
    mk('t-none', { title: 'Studiare il settore' }),
    mk('t-done', {
      title: 'Inviata candidatura',
      status: 'done',
      completedAt: Date.UTC(2026, 10, 5, 10),
      dueOn: '2026-11-04',
    }),
  ];

  it('mostra riepilogo reale, sezioni e scadenze calcolate con la data del SERVER (asOf)', async () => {
    tasksApi(sample);
    renderApp('/tasks');
    expect(await screen.findByRole('heading', { level: 1, name: 'Attività' })).toBeInTheDocument();
    // Riepilogo = dati dell'API, mai valori fissi.
    expect(await screen.findByRole('button', { name: 'Da fare: 4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In ritardo: 1' })).toBeInTheDocument();
    expect(within(screen.getByTestId('summary-today')).getByText('1')).toBeInTheDocument();
    // Sezioni derivate dalla classificazione, con testi comprensibili (nessun timestamp tecnico).
    for (const name of [/In ritardo/, /^Oggi/, /Prossime/, /Senza scadenza/, /Completate/])
      expect(await screen.findByRole('heading', { level: 2, name })).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem').filter((li) => li.hasAttribute('data-task-row'));
    expect(rows).toHaveLength(5);
    expect(within(rows[0]!).getByText('Scaduta ieri')).toBeInTheDocument(); // ieri rispetto ad asOf, non al browser
    expect(within(rows[2]!).getByText('Tra 2 giorni')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Priorità alta')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Follow-up')).toBeInTheDocument();
    expect(screen.queryByText(/\d{4}-\d{2}-\d{2}T/)).not.toBeInTheDocument();
  });

  it('i filtri vivono nell’indirizzo e interrogano la vista giusta', async () => {
    const user = userEvent.setup();
    const calls = tasksApi(sample);
    const { router } = renderApp('/tasks');
    await screen.findByRole('button', { name: 'Da fare: 4' });
    await user.click(screen.getByRole('button', { name: 'Completate' }));
    await waitFor(() => expect(router.state.location.search).toBe('?vista=completate'));
    await waitFor(() => expect(calls.some((c) => c.path.includes('view=done'))).toBe(true));
    expect(await screen.findByText('Inviata candidatura')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Completate' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Tutte' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('stati vuoti contestuali, senza dati simulati', async () => {
    const user = userEvent.setup();
    tasksApi([]);
    renderApp('/tasks');
    expect(await screen.findByText('Nessuna attività, per ora')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aggiungi la prima attività' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'In ritardo: 0' }));
    expect(await screen.findByText('Nessuna attività in ritardo')).toBeInTheDocument();
    expect(screen.getByText('Niente in scadenza oggi')).toBeInTheDocument();
  });

  it('«Da fare» vuoto con attività completate: messaggio positivo', async () => {
    tasksApi([mk('d', { status: 'done', completedAt: 1 })]);
    renderApp('/tasks?vista=da-fare');
    expect(await screen.findByText('Non hai attività da fare. Ottimo lavoro!')).toBeInTheDocument();
  });

  it('completare chiama il comando, avvisa e riallinea l’elenco; un errore resta visibile', async () => {
    const user = userEvent.setup();
    let state = mk('t1', { title: 'Richiama HR', dueOn: '2026-11-06' });
    const calls = tasksApi([state], {
      'POST /tasks/t1/complete': () => {
        state = { ...state, status: 'done', completedAt: 9, updatedAt: 6_000 };
        return { body: { task: state, asOf: ASOF } };
      },
    });
    renderApp('/tasks');
    await user.click(
      await screen.findByRole('button', { name: 'Segna come completata: Richiama HR' }),
    );
    expect(await screen.findByText('Attività completata.')).toBeInTheDocument();
    expect(
      calls.filter((c) => c.method === 'POST' && c.path.startsWith('/tasks/t1/complete')),
    ).toHaveLength(1);
  });

  it('errore del server su un comando: avviso di errore, riga invariata', async () => {
    const user = userEvent.setup();
    tasksApi([mk('t1', { title: 'Richiama HR' })], {
      'POST /tasks/t1/complete': () =>
        failure(409, 'La attività è annullata: riaprila prima di completarla'),
    });
    renderApp('/tasks');
    await user.click(
      await screen.findByRole('button', { name: 'Segna come completata: Richiama HR' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/annullata/);
    expect(
      screen.getByRole('button', { name: 'Segna come completata: Richiama HR' }),
    ).toBeEnabled();
  });

  it('creazione rapida: stessa mutazione e ID stabile, poi il campo si svuota', async () => {
    const user = userEvent.setup();
    const calls = tasksApi([], {
      'POST /tasks': ({ body }: { body: unknown }) => ({
        status: 201,
        body: { task: mk('n1', { title: (body as { title: string }).title }), asOf: ASOF },
      }),
    });
    renderApp('/tasks');
    const input = await screen.findByLabelText('Aggiungi un’attività');
    await user.type(input, 'Aggiornare il portfolio{Enter}');
    await screen.findByText('Attività creata.');
    const post = calls.find((c) => c.method === 'POST' && c.path.startsWith('/tasks'));
    expect(post?.body).toMatchObject({
      title: 'Aggiornare il portfolio',
      kind: 'general',
      priority: 'none',
    });
    expect((post?.body as { id: string }).id).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(input).toHaveValue(''));
  });
});

describe('dialog di creazione e modifica', () => {
  it('crea con scadenza rapida: payload esatto, ID del client, data senza orario', async () => {
    const user = userEvent.setup();
    const calls = tasksApi([], {
      'POST /tasks': ({ body }: { body: unknown }) => ({
        status: 201,
        body: { task: mk('n1', { title: (body as { title: string }).title }), asOf: ASOF },
      }),
    });
    renderApp('/tasks');
    await user.click(await screen.findByRole('button', { name: 'Nuova attività' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuova attività' });
    expect(within(dialog).getByRole('button', { name: 'Crea attività' })).toBeDisabled(); // titolo obbligatorio
    await user.type(within(dialog).getByLabelText('Titolo'), 'Inviare il follow-up');
    await user.click(within(dialog).getByRole('button', { name: 'Domani' }));
    expect(within(dialog).getByLabelText('Scadenza')).toHaveValue('2026-11-08');
    await user.click(within(dialog).getByRole('button', { name: 'Crea attività' }));
    await screen.findByText('Attività creata.');
    const post = calls.find((c) => c.method === 'POST' && c.path.startsWith('/tasks'));
    expect(post?.body).toMatchObject({
      title: 'Inviare il follow-up',
      dueOn: '2026-11-08',
      kind: 'general',
      priority: 'none',
      cardId: null,
    });
    expect(JSON.stringify(post?.body)).not.toMatch(/dueAt|T\d{2}:\d{2}/);
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Nuova attività' })).not.toBeInTheDocument(),
    );
  });

  it('risposta persa: campi bloccati e retry con lo STESSO ID e lo stesso payload', async () => {
    const user = userEvent.setup();
    let lost = true;
    const calls = tasksApi([], {
      'POST /tasks': ({ body }: { body: unknown }) => {
        if (lost) {
          lost = false;
          throw new TypeError('lost');
        }
        return {
          status: 200,
          body: { task: mk('n1', { title: (body as { title: string }).title }), asOf: ASOF },
        };
      },
    });
    renderApp('/tasks');
    await user.click(await screen.findByRole('button', { name: 'Nuova attività' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuova attività' });
    await user.type(within(dialog).getByLabelText('Titolo'), 'Una sola volta');
    await user.click(within(dialog).getByRole('button', { name: 'Crea attività' }));
    expect(
      await within(dialog).findByText(/l’operazione potrebbe essere riuscita/),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Titolo')).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Riprova la stessa richiesta' }));
    await screen.findByText('Attività creata.');
    const posts = calls.filter((c) => c.method === 'POST' && c.path.startsWith('/tasks'));
    expect(posts).toHaveLength(2);
    expect(posts[1]?.body).toEqual(posts[0]?.body);
  });

  it('bozza protetta: Esc con modifiche chiede conferma; senza modifiche chiude subito', async () => {
    const user = userEvent.setup();
    tasksApi([]);
    renderApp('/tasks');
    await user.click(await screen.findByRole('button', { name: 'Nuova attività' }));
    await screen.findByRole('dialog', { name: 'Nuova attività' });
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Nuova attività' })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Nuova attività' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuova attività' });
    await user.type(within(dialog).getByLabelText('Titolo'), 'Bozza');
    await user.keyboard('{Escape}');
    const confirm = await screen.findByRole('alertdialog', { name: 'Hai modifiche non salvate' });
    await user.click(within(confirm).getByRole('button', { name: 'Annulla' })); // resta nella bozza
    expect(screen.getByRole('dialog', { name: 'Nuova attività' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog', { name: 'Nuova attività' })).getByLabelText('Titolo'),
    ).toHaveValue('Bozza');
    await user.keyboard('{Escape}');
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Esci senza salvare',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Nuova attività' })).not.toBeInTheDocument(),
    );
  });

  it('modifica: invia solo i campi cambiati con expectedUpdatedAt; su 409 si ricarica il token e si salva di nuovo', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const base = mk('t1', { title: 'Richiama HR', updatedAt: 5_000 });
    const calls = tasksApi([base], {
      'PATCH /tasks/t1': ({ body }: { body: { expectedUpdatedAt: number; title: string } }) => {
        attempts += 1;
        if (attempts === 1)
          return failure(409, 'L’attività è cambiata nel frattempo: aggiorna la pagina');
        return { body: { task: { ...base, title: body.title, updatedAt: 9_000 }, asOf: ASOF } };
      },
      'GET /tasks/t1': () => ({ body: { task: { ...base, updatedAt: 7_000 }, asOf: ASOF } }),
    } as never);
    renderApp('/tasks');
    await user.click(await screen.findByRole('button', { name: 'Richiama HR' }));
    const dialog = await screen.findByRole('dialog', { name: 'Modifica attività' });
    expect(within(dialog).getByRole('button', { name: 'Salva modifiche' })).toBeDisabled(); // nessuna modifica
    const title = within(dialog).getByLabelText('Titolo');
    await user.clear(title);
    await user.type(title, 'Richiama la recruiter');
    await user.click(within(dialog).getByRole('button', { name: 'Salva modifiche' }));
    await user.click(
      await within(dialog).findByRole('button', { name: 'Ricarica i dati più recenti' }),
    );
    await within(dialog).findByText(/le tue modifiche sono ancora qui/);
    expect(within(dialog).getByLabelText('Titolo')).toHaveValue('Richiama la recruiter');
    await user.click(within(dialog).getByRole('button', { name: 'Salva modifiche' }));
    await screen.findByText('Attività aggiornata.');
    const patches = calls.filter((c) => c.method === 'PATCH');
    expect(patches[0]?.body).toEqual({ expectedUpdatedAt: 5_000, title: 'Richiama la recruiter' });
    expect(patches[1]?.body).toEqual({ expectedUpdatedAt: 7_000, title: 'Richiama la recruiter' });
  });

  it('un’attività completata è in sola lettura: si riapre dall’elenco', async () => {
    const user = userEvent.setup();
    tasksApi([mk('t1', { title: 'Fatta', status: 'done', completedAt: 1 })]);
    renderApp('/tasks');
    await user.click(await screen.findByRole('button', { name: 'Fatta' }));
    const dialog = await screen.findByRole('dialog', { name: 'Modifica attività' });
    expect(within(dialog).getByLabelText('Titolo')).toBeDisabled();
    expect(within(dialog).getByRole('status')).toHaveTextContent(/riaprila dall’elenco/);
    expect(
      within(dialog).queryByRole('button', { name: 'Salva modifiche' }),
    ).not.toBeInTheDocument();
  });
});

/* ------------------------- sezione nella candidatura e suggerimenti ------------------------- */

function renderSection(c: Card, archived = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    const registry = useRef(new Set<string>());
    return (
      <Providers client={client}>
        <WorkspaceContext.Provider value={{ user: USER, workspace: WORKSPACE }}>
          <DirtyGuardContext.Provider value={registry}>
            <NoticeProvider>{children}</NoticeProvider>
          </DirtyGuardContext.Provider>
        </WorkspaceContext.Provider>
      </Providers>
    );
  }
  // useBlocker (bozze protette) richiede un data router, come nell'app reale.
  const router = createMemoryRouter([
    {
      path: '*',
      element: (
        <Wrapper>
          <CardTasksSection card={c} archived={archived} />
        </Wrapper>
      ),
    },
  ]);
  render(<RouterProvider router={router} />);
  return client;
}
const applied = (): Card => ({
  ...card('k1', 'Infermiere', 'c1', 1),
  stage: 'applied',
  appliedOn: '2026-11-01',
  company: 'ACME',
});

describe('sezione «Attività» della candidatura', () => {
  const linked = (id: string, over: Partial<Task> = {}) =>
    mk(id, {
      cardId: 'k1',
      card: { id: 'k1', boardId: 'b1', title: 'Infermiere', company: 'ACME', archived: false },
      ...over,
    });
  const interviewsApi = (list: unknown[] = []) => ({
    'GET /cards/k1/interviews': () => ({ body: { interviews: list } }),
  });

  it('suggerimento S1 dopo l’invio: non crea nulla; «Pianifica» apre il modulo precompilato', async () => {
    const user = userEvent.setup();
    const calls = tasksApi([], interviewsApi());
    renderSection(applied());
    const hint = await screen.findByRole('complementary', { name: 'Suggerimento' });
    expect(hint).toHaveTextContent('Hai inviato la candidatura: vuoi pianificare un follow-up?');
    expect(calls.some((c) => c.method !== 'GET')).toBe(false); // un suggerimento NON crea una Task
    await user.click(within(hint).getByRole('button', { name: 'Pianifica' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuova attività' });
    expect(within(dialog).getByLabelText('Titolo')).toHaveValue('Follow-up: ACME');
    expect(within(dialog).getByLabelText('Scadenza')).toHaveValue('2026-11-08'); // invio + 7 giorni
    expect(within(dialog).getByTestId('task-linked-card')).toHaveTextContent('ACME · Infermiere');
    expect(
      within(dialog).queryByRole('button', { name: /Rimuovi il collegamento/ }),
    ).not.toBeInTheDocument();
    expect(calls.some((c) => c.method !== 'GET')).toBe(false); // nemmeno aprire il modulo crea nulla
  });

  it('«Non ora» nasconde il suggerimento e lo ricorda (per dispositivo) senza dati riservati', async () => {
    const user = userEvent.setup();
    tasksApi([], interviewsApi());
    const first = renderSection(applied());
    await user.click(await screen.findByRole('button', { name: 'Non ora' }));
    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'Suggerimento' })).not.toBeInTheDocument(),
    );
    expect(window.localStorage.getItem('jobward:task-suggestion:w1:S1:2026-11-01')).toBe('1');
    expect(JSON.stringify({ ...window.localStorage })).not.toMatch(/ACME|Infermiere/);
    first.clear();
  });

  it('un’attività storica (anche annullata) vale come decisione: nessun suggerimento', async () => {
    tasksApi(
      [linked('c1', { kind: 'follow_up', status: 'cancelled', cancelledAt: 3 })],
      interviewsApi(),
    );
    renderSection(applied());
    await screen.findByText(/Nessuna attività aperta per questa candidatura/);
    expect(screen.queryByRole('complementary', { name: 'Suggerimento' })).not.toBeInTheDocument();
  });

  it('mostra le aperte con la scadenza evidenziata e porta all’elenco filtrato', async () => {
    tasksApi(
      [
        linked('a', { title: 'Scaduta!', dueOn: '2026-11-01', kind: 'follow_up' }),
        linked('b', { title: 'Domani', dueOn: '2026-11-08' }),
      ],
      interviewsApi(),
    );
    renderSection(applied());
    const list = await screen.findByRole('list', { name: 'Attività aperte' });
    expect(within(list).getByText(/Scaduta da 6 giorni/)).toBeInTheDocument();
    expect(within(list).getByText('Domani', { selector: 'time' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Apri nell’elenco delle attività/ })).toHaveAttribute(
      'href',
      '/tasks?candidatura=k1',
    );
  });

  it('candidatura archiviata: sola lettura, nessuna creazione, nessun suggerimento', async () => {
    tasksApi([linked('a', { title: 'Letta soltanto' })], interviewsApi());
    renderSection(applied(), true);
    expect(await screen.findByText('Letta soltanto')).toBeInTheDocument();
    expect(screen.getByText(/in sola lettura/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Aggiungi attività|Pianifica un follow-up/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Segna come completata: Letta soltanto' }),
    ).toBeDisabled();
    expect(screen.queryByRole('complementary', { name: 'Suggerimento' })).not.toBeInTheDocument();
  });

  it('completare dalla candidatura riallinea elenchi, Overview e Timeline della card', async () => {
    const user = userEvent.setup();
    let t = linked('a', { title: 'Da chiudere' });
    tasksApi([t], {
      ...interviewsApi(),
      'POST /tasks/a/complete': () => {
        t = { ...t, status: 'done', completedAt: 5, updatedAt: 6_000 };
        return { body: { task: t, asOf: ASOF } };
      },
    });
    const client = renderSection({ ...applied(), stage: 'interviewing' });
    for (const key of [
      keys.overview('w1'),
      keys.timeline('w1', 'k1'),
      [...keys.tasks('w1'), 'summary'],
    ])
      client.setQueryData(key, {});
    client.setQueryData(keys.timeline('w1', 'altra'), {});
    await user.click(
      await screen.findByRole('button', { name: 'Segna come completata: Da chiudere' }),
    );
    await screen.findByText('Attività completata.');
    await waitFor(() =>
      expect(client.getQueryState(keys.overview('w1'))?.isInvalidated).toBe(true),
    );
    expect(client.getQueryState(keys.timeline('w1', 'k1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState([...keys.tasks('w1'), 'summary'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys.timeline('w1', 'altra'))?.isInvalidated).toBe(false); // nessuna invalidazione globale
  });
});

describe('presentazione', () => {
  const open = (dueOn: string | null) => mk('x', { dueOn });
  it('testi relativi alla data del server, mai timestamp', () => {
    expect(describeDue(open('2026-11-06'), ASOF).text).toBe('Scaduta ieri');
    expect(describeDue(open('2026-11-01'), ASOF).text).toBe('Scaduta da 6 giorni');
    expect(describeDue(open('2026-11-07'), ASOF).text).toBe('Oggi');
    expect(describeDue(open('2026-11-08'), ASOF).text).toBe('Domani');
    expect(describeDue(open('2026-11-10'), ASOF).text).toBe('Tra 3 giorni');
    expect(describeDue(open('2026-11-11'), ASOF).text).toBe('11 nov 2026');
    expect(describeDue(open(null), ASOF).text).toBe('Senza scadenza');
    expect(describeDue(open('2026-11-06'), ASOF).tone).toBe('overdue');
  });
  it('completata in ritardo e annullata, nel fuso del workspace', () => {
    const done = mk('d', {
      status: 'done',
      dueOn: '2026-11-01',
      completedAt: Date.UTC(2026, 10, 3, 12),
    });
    expect(describeDue(done, ASOF).text).toBe('Completata il 3 nov 2026 (in ritardo)');
    const ok = mk('d', {
      status: 'done',
      dueOn: '2026-11-03',
      completedAt: Date.UTC(2026, 10, 3, 12),
    });
    expect(describeDue(ok, ASOF).text).toBe('Completata il 3 nov 2026');
    expect(
      describeDue(mk('c', { status: 'cancelled', cancelledAt: Date.UTC(2026, 10, 3, 12) }), ASOF)
        .text,
    ).toBe('Annullata il 3 nov 2026');
  });
  it('Timeline: voci derivate con tipo e genere corretti, senza titolo', () => {
    const entry = (kind: string, taskKind: string) =>
      ({
        id: 'x:y',
        source: 'task',
        kind,
        occurredAt: 1,
        entity: { type: 'task', id: 'x' },
        data: { taskId: 'x', taskKind },
      }) as never;
    expect(describeTimelineEntry(entry('task_created', 'general'), 'UTC')).toBe('Attività creata');
    expect(describeTimelineEntry(entry('task_completed', 'follow_up'), 'UTC')).toBe(
      'Follow-up completato',
    );
    expect(describeTimelineEntry(entry('task_cancelled', 'preparation'), 'UTC')).toBe(
      'Preparazione annullata',
    );
  });
});
