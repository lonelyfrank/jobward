import type { Card, CardDocument, Note, PipelineTransitionInput } from '@jobward/schemas';
import { QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Providers } from '@/app/providers';
import { NoticeProvider } from '@/components/ui/notices';
import { NotesTab } from '@/features/notes/notes-tab';
import { DocumentsTab } from '@/features/documents/documents-tab';
import { PipelinePanel } from '@/features/pipeline/pipeline-panel';
import { TimelineTab } from '@/features/timeline/timeline-tab';
import { InterviewForm } from '@/features/interviews/interview-form';
import { WorkspaceContext } from '@/features/workspace/context';
import { boardDetail, card } from '@/test/fixtures';
import { mockApi, renderApp, USER, WORKSPACE, withWorkspace } from '@/test/utils';
import { DirtyGuardContext } from './dirty-guard';
import { keys } from '@/features/boards/api';

const c = () => card('k1', 'Barista part-time', 'c1', 1);
function setup(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper() {
    const registry = useRef(new Set<string>());
    return (
      <Providers client={client}>
        <WorkspaceContext.Provider value={{ user: USER, workspace: WORKSPACE }}>
          <DirtyGuardContext.Provider value={registry}>
            {/* I link (es. «Vedile» nell'avviso di chiusura) richiedono un router. */}
            <MemoryRouter>
              <NoticeProvider>{children}</NoticeProvider>
            </MemoryRouter>
          </DirtyGuardContext.Provider>
        </WorkspaceContext.Provider>
      </Providers>
    );
  }
  render(<Wrapper />);
  return client;
}
const failure = (status: number, message: string) => ({
  status,
  body: { error: { code: status === 409 ? 'conflict' : 'validation_error', message } },
});

describe('note e riferimenti — integrazione frontend', () => {
  it('crea, modifica ed elimina una nota via 204; invalida solo le dipendenze della candidatura', async () => {
    const user = userEvent.setup();
    let notes: Note[] = [];
    const calls = mockApi({
      'GET /cards/k1/notes': () => ({ body: { notes, nextCursor: null } }),
      'POST /cards/k1/notes': ({ body }) => {
        const input = body as { id: string; body: string };
        notes = [{ ...input, cardId: 'k1', createdAt: 1, updatedAt: 1 }];
        return { status: 201, body: { note: notes[0] } };
      },
      'PATCH /notes/note-one': () => ({ body: {} }),
    });
    const client = setup(<NotesTab card={c()} active timeZone="UTC" />);
    client.setQueryData(keys.card('w1', 'k1'), {});
    client.setQueryData(keys.card('w1', 'unrelated'), {});
    await screen.findByText('Nessuna nota registrata.');
    await user.click(screen.getByRole('button', { name: 'Aggiungi nota' }));
    await user.type(screen.getByLabelText('Testo della nota'), 'Telefonare lunedì');
    await user.click(screen.getByRole('button', { name: 'Salva nota' }));
    await screen.findByText('Telefonare lunedì');
    expect(client.getQueryState(keys.card('w1', 'k1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys.card('w1', 'unrelated'))?.isInvalidated).toBe(false);
    const note = notes[0]!;
    // Gli handler usano l'ID effettivamente generato dal modulo.
    mockApi({
      'GET /cards/k1/notes': () => ({ body: { notes, nextCursor: null } }),
      [`PATCH /notes/${note.id}`]: ({ body }) => {
        notes = [{ ...note, ...(body as { body: string }) }];
        return { body: { note: notes[0] } };
      },
      [`DELETE /notes/${note.id}`]: () => {
        notes = [];
        return { status: 204, body: null };
      },
    });
    await user.click(screen.getByRole('button', { name: 'Modifica nota' }));
    await user.clear(screen.getByLabelText('Testo della nota'));
    await user.type(screen.getByLabelText('Testo della nota'), 'Già contattati');
    await user.click(screen.getByRole('button', { name: 'Salva nota' }));
    await screen.findByText('Già contattati');
    await user.click(screen.getByRole('button', { name: 'Elimina nota' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Elimina nota' }),
    );
    await screen.findByText('Nessuna nota registrata.');
    expect(calls.find((r) => r.method === 'POST')?.body).toMatchObject({
      body: 'Telefonare lunedì',
    });
  });
  it('risposta persa: blocca il testo e ripete ID/payload; un 200 replay non duplica la nota', async () => {
    const user = userEvent.setup();
    let first = true;
    let saved: Note | null = null;
    const calls = mockApi({
      'GET /cards/k1/notes': () => ({ body: { notes: saved ? [saved] : [], nextCursor: null } }),
      'POST /cards/k1/notes': ({ body }) => {
        const input = body as { id: string; body: string };
        saved = { ...input, cardId: 'k1', createdAt: 1, updatedAt: 1 };
        if (first) {
          first = false;
          throw new TypeError('response lost');
        }
        return { status: 200, body: { note: saved } };
      },
    });
    setup(<NotesTab card={c()} active timeZone="UTC" />);
    await user.click(await screen.findByRole('button', { name: 'Aggiungi nota' }));
    await user.type(screen.getByLabelText('Testo della nota'), 'Bozza da conservare');
    await user.click(screen.getByRole('button', { name: 'Salva nota' }));
    await screen.findByText(/l’operazione potrebbe essere riuscita/);
    expect(screen.getByLabelText('Testo della nota')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Riprova la stessa richiesta' }));
    await screen.findByText('Bozza da conservare');
    const posts = calls.filter((r) => r.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[1]?.body).toEqual(posts[0]?.body);
  });
  it('documenti: URL pericoloso rifiutato; crea e modifica senza sovrascrivere i campi intatti', async () => {
    const user = userEvent.setup();
    let documents: CardDocument[] = [];
    const calls = mockApi({
      'GET /cards/k1/documents': () => ({ body: { documents } }),
      'POST /cards/k1/documents': ({ body }) => {
        const input = body as CardDocument;
        documents = [{ ...input, cardId: 'k1', createdAt: 1, updatedAt: 1 }];
        return { status: 201, body: { document: documents[0] } };
      },
    });
    setup(<DocumentsTab card={c()} active />);
    await user.click(await screen.findByRole('button', { name: 'Aggiungi riferimento' }));
    await user.type(screen.getByLabelText('Titolo del documento'), 'CV');
    await user.type(screen.getByLabelText('URL (facoltativo)'), 'javascript:alert(1)');
    await user.click(screen.getByRole('button', { name: 'Salva riferimento' }));
    await screen.findByRole('alert');
    expect(calls.some((r) => r.method === 'POST')).toBe(false);
    await user.clear(screen.getByLabelText('URL (facoltativo)'));
    await user.type(screen.getByLabelText('URL (facoltativo)'), 'https://example.com/cv');
    await user.click(screen.getByRole('button', { name: 'Salva riferimento' }));
    const link = await screen.findByRole('link', { name: /Apri documento/ });
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const doc = documents[0]!;
    const edits = mockApi({
      'GET /cards/k1/documents': () => ({ body: { documents } }),
      [`PATCH /documents/${doc.id}`]: ({ body }) => {
        documents = [{ ...doc, ...(body as object) }];
        return { body: { document: documents[0] } };
      },
    });
    await user.click(screen.getByRole('button', { name: 'Modifica riferimento' }));
    await user.clear(screen.getByLabelText('Titolo del documento'));
    await user.type(screen.getByLabelText('Titolo del documento'), 'CV aggiornato');
    await user.click(screen.getByRole('button', { name: 'Salva riferimento' }));
    await screen.findByText('CV aggiornato');
    expect(edits.find((r) => r.method === 'PATCH')?.body).toEqual({ title: 'CV aggiornato' });
  });
  it('conflitto 409 conserva la bozza; solo l’aggiornamento esplicito prepara un nuovo ID', async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      'GET /cards/k1/notes': () => ({ body: { notes: [], nextCursor: null } }),
      'POST /cards/k1/notes': () => failure(409, 'Stato cambiato'),
    });
    setup(<NotesTab card={c()} active timeZone="UTC" />);
    await user.click(await screen.findByRole('button', { name: 'Aggiungi nota' }));
    await user.type(screen.getByLabelText('Testo della nota'), 'Non perdere');
    await user.click(screen.getByRole('button', { name: 'Salva nota' }));
    await screen.findByText(/Stato cambiato.*Aggiorna/);
    expect(screen.getByRole('button', { name: 'Riprova la stessa richiesta' })).toBeDisabled();
    await user.click(
      screen.getByRole('button', { name: 'Aggiorna dati e prepara nuova richiesta' }),
    );
    expect(screen.getByLabelText('Testo della nota')).toHaveValue('Non perdere');
    await user.click(screen.getByRole('button', { name: 'Salva nota' }));
    await waitFor(() => expect(calls.filter((r) => r.method === 'POST')).toHaveLength(2));
    const ids = calls.filter((r) => r.method === 'POST').map((r) => (r.body as { id: string }).id);
    expect(ids[0]).not.toBe(ids[1]);
  });
});

describe('pipeline e timeline — integrazione frontend', () => {
  it('conferma chiusura con avvisi e conserva i colloqui per default; retry identico, cache coerente', async () => {
    const user = userEvent.setup();
    const original: Card = {
      ...c(),
      stage: 'interviewing',
      interviewSummary: {
        total: 1,
        completed: 0,
        action: null,
        next: {
          id: 'i1',
          sequence: 1,
          title: 'Round',
          type: 'other',
          modality: null,
          scheduledAt: 2000000000000,
          timezone: 'UTC',
        },
      },
    };
    let lost = true;
    const calls = mockApi({
      'POST /cards/k1/pipeline': ({ body }) => {
        const input = body as PipelineTransitionInput;
        if (lost) {
          lost = false;
          throw new TypeError('lost');
        }
        return {
          body: {
            card: { ...original, stage: 'closed', outcome: 'rejected' },
            transition: { id: input.id, kind: input.kind, from: 'interviewing', to: 'rejected' },
            replayed: true,
            cancelledInterviews: 0,
            warnings: [{ code: 'future_interviews_on_closed' }],
          },
        };
      },
    });
    const client = setup(<PipelinePanel card={original} />);
    for (const key of [
      keys.interviews('w1', 'k1'),
      keys.timeline('w1', 'k1'),
      keys.board('w1', 'b1'),
      keys.opportunities('w1'),
    ])
      client.setQueryData(key, {});
    client.setQueryData(keys.board('w1', 'unrelated'), {});
    await user.selectOptions(screen.getByLabelText('Azione'), 'close');
    await user.selectOptions(screen.getByLabelText('Stato di destinazione'), 'rejected');
    await user.click(screen.getByRole('button', { name: 'Registra un esito' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByLabelText('Conserva i colloqui programmati')).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Conferma passaggio' }));
    await within(dialog).findByText(/l’operazione potrebbe essere riuscita/);
    await user.click(within(dialog).getByRole('button', { name: 'Riprova la stessa richiesta' }));
    await screen.findByText('Operazione già registrata: dati aggiornati.');
    // Le attività collegate si leggono con un GET (solo avviso): il confronto riguarda i POST.
    const posts = calls.filter((call) => call.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[1]?.body).toEqual(posts[0]?.body);
    expect(posts[0]?.body).toMatchObject({
      futureInterviews: 'keep',
      expectedFrom: 'interviewing',
    });
    expect(client.getQueryState(keys.interviews('w1', 'k1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys.timeline('w1', 'k1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys.board('w1', 'unrelated'))?.isInvalidated).toBe(false);
    expect(screen.getByText(/chiusa ma ha colloqui futuri/)).toBeVisible();
  });
  it('la chiusura informa delle attività aperte collegate ma non le completa né le annulla', async () => {
    const user = userEvent.setup();
    const original: Card = { ...c(), stage: 'applied' };
    const task = (id: string) => ({
      id,
      cardId: 'k1',
      card: { id: 'k1', boardId: 'b1', title: 'Infermiere', company: null, archived: false },
      title: `Task ${id}`,
      description: null,
      kind: 'follow_up',
      priority: 'none',
      dueOn: null,
      status: 'open',
      completedAt: null,
      cancelledAt: null,
      createdAt: 1,
      updatedAt: 1,
    });
    const calls = mockApi({
      'GET /tasks': () => ({
        body: {
          tasks: [task('a'), task('b')],
          nextCursor: null,
          asOf: { today: '2026-11-07', timeZone: 'Europe/Rome' },
        },
      }),
    });
    setup(<PipelinePanel card={original} />);
    await user.selectOptions(screen.getByLabelText('Azione'), 'close');
    await user.selectOptions(screen.getByLabelText('Stato di destinazione'), 'rejected');
    await user.click(screen.getByRole('button', { name: 'Registra un esito' }));
    const dialog = await screen.findByRole('alertdialog');
    const notice = await within(dialog).findByTestId('linked-tasks-notice');
    expect(notice).toHaveTextContent('Hai 2 attività aperte collegate');
    expect(notice).toHaveTextContent('non le completa né le annulla');
    expect(within(dialog).getByRole('link', { name: 'Vedile' })).toHaveAttribute(
      'href',
      '/tasks?candidatura=k1',
    );
    expect(calls.some((call) => call.path.startsWith('/tasks') && call.method !== 'GET')).toBe(
      false,
    );
  });
  it('timeline usa il cursore, conserva l’ordine e non duplica sovrapposizioni; errore di pagina ritentabile', async () => {
    const user = userEvent.setup();
    const entry = (id: string) => ({
      id,
      source: 'system',
      kind: 'application_reopened',
      occurredAt: 1,
      entity: null,
      data: { operationId: 'private' },
    });
    let failed = false;
    const calls = mockApi({
      'GET /cards/k1/timeline': ({ path }) => {
        if (path.includes('before=')) {
          if (!failed) {
            failed = true;
            return failure(500, 'Errore');
          }
          return { body: { entries: [entry('a'), entry('b')], nextCursor: null } };
        }
        return { body: { entries: [entry('a')], nextCursor: 'cursor-one' } };
      },
    });
    setup(<TimelineTab cardId="k1" timeZone="UTC" active />);
    await screen.findByText('Candidatura riaperta');
    await user.click(screen.getByRole('button', { name: 'Carica altri eventi' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Riprova' }));
    await waitFor(() => expect(screen.getAllByText('Candidatura riaperta')).toHaveLength(2));
    expect(calls.some((r) => r.path.includes('before=cursor-one'))).toBe(true);
    expect(screen.queryByText('private')).not.toBeInTheDocument();
  });
});

describe('bozze e colloqui', () => {
  it('bozza nota sopravvive a cambio tab e back; chiusura e refresh sono protetti', async () => {
    const user = userEvent.setup();
    const detail = boardDetail();
    mockApi({
      ...withWorkspace(),
      'GET /boards': () => ({ body: { boards: [] } }),
      'GET /boards/b1': () => ({ body: detail }),
      'GET /cards/k1': () => ({ body: { card: detail.cards[0], history: [] } }),
      'GET /cards/k1/custom-fields': () => ({ body: { fields: [] } }),
      'GET /labels': () => ({ body: { labels: [] } }),
      'GET /cards/k1/interviews': () => ({ body: { interviews: [] } }),
      'GET /cards/k1/notes': () => ({ body: { notes: [], nextCursor: null } }),
      'GET /cards/k1/documents': () => ({ body: { documents: [] } }),
    });
    const { router } = renderApp('/boards/b1/cards/k1#note');
    await user.click(await screen.findByRole('button', { name: 'Aggiungi nota' }));
    await user.type(screen.getByLabelText('Testo della nota'), 'Bozza importante');
    await user.click(screen.getByRole('tab', { name: 'Documenti' }));
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Documenti' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
    await user.click(screen.getByRole('tab', { name: 'Note' }));
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Note' })).toHaveAttribute('aria-selected', 'true'),
    );
    expect(screen.getByLabelText('Testo della nota')).toHaveValue('Bozza importante');
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Chiudi' }));
    const guard = await screen.findByRole('alertdialog', { name: 'Hai modifiche non salvate' });
    await user.click(within(guard).getByRole('button', { name: 'Torna alla scheda' }));
    expect(screen.getByLabelText('Testo della nota')).toHaveValue('Bozza importante');
    await act(() => router.navigate(-1));
    await waitFor(() => expect(router.state.location.hash).toBe('#documenti'));
    await act(() => router.navigate(1));
    await waitFor(() =>
      expect(screen.getByLabelText('Testo della nota')).toHaveValue('Bozza importante'),
    );
  });
  it('una bozza nata durante l’archiviazione in volo resta protetta', async () => {
    const user = userEvent.setup();
    const detail = boardDetail();
    let current = detail.cards[0]!;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockApi({
      ...withWorkspace(),
      'GET /boards': () => ({ body: { boards: [] } }),
      'GET /boards/b1': () => ({ body: detail }),
      'GET /cards/k1': () => ({ body: { card: current, history: [] } }),
      'GET /cards/k1/custom-fields': () => ({ body: { fields: [] } }),
      'GET /labels': () => ({ body: { labels: [] } }),
      'GET /cards/k1/interviews': () => ({ body: { interviews: [] } }),
      'GET /cards/k1/notes': () => ({ body: { notes: [], nextCursor: null } }),
      'POST /cards/k1/archive': async () => {
        await gate;
        current = { ...current, archivedAt: 1700000010000 };
        return { body: { card: current } };
      },
    });
    renderApp('/boards/b1/cards/k1');
    await user.click(await screen.findByRole('button', { name: 'Archivia' }));
    await user.click(screen.getByRole('tab', { name: 'Note' }));
    await user.click(await screen.findByRole('button', { name: 'Aggiungi nota' }));
    await user.type(screen.getByLabelText('Testo della nota'), 'Bozza durante attesa');
    await act(async () => {
      release();
      await gate;
    });
    const guard = await screen.findByRole('alertdialog', { name: 'Hai modifiche non salvate' });
    await user.click(within(guard).getByRole('button', { name: 'Torna alla scheda' }));
    expect(screen.getByLabelText('Testo della nota')).toHaveValue('Bozza durante attesa');
  });
  it('creazione colloquio include ID stabile e payload originale dopo perdita della risposta', async () => {
    const user = userEvent.setup();
    const payloads: unknown[] = [];
    setup(
      <InterviewForm
        mode="create"
        interview={null}
        workspaceZone="UTC"
        suggestedTitle="Round 1"
        onCancel={() => {}}
        onSave={(payload) => {
          payloads.push(payload);
          return Promise.reject(new TypeError('lost'));
        }}
      />,
    );
    await user.type(screen.getByLabelText('Titolo'), 'Tecnico');
    await user.click(screen.getByRole('button', { name: 'Aggiungi colloquio' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Riprova la stessa richiesta' }));
    await waitFor(() => expect(payloads).toHaveLength(2));
    expect(payloads[0]).toMatchObject({ id: expect.any(String), title: 'Tecnico' });
    expect(payloads[1]).toEqual(payloads[0]);
  });
});
