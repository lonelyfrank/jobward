import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  applicationDetailsInput,
  cardDetailsInput,
  salaryIssues,
  createBoardInput,
  createCardInput,
  createColumnInput,
  createTaskInput,
  updateTaskInput,
  tasksQuery,
  taskSchema,
  taskCommandInput,
  overviewResponse,
  timelineEntrySchema,
  createWorkspaceInput,
  deleteColumnInput,
  moveCardInput,
  moveInput,
  updateBoardInput,
  updateCardInput,
  updateColumnInput,
  customFieldDefinitionInput,
  parseStoredCustomFieldValue,
  serializeCustomFieldValue,
  validateCustomFieldValue,
  type CustomFieldDefinitionInput,
  type CustomFieldValue,
  summarizeInterviews,
  createInterviewInput,
  clientIdSchema,
  createDocumentInput,
  createNoteInput,
  pipelineTransitionInput,
  timelineQuery,
  updateDocumentInput,
  updateNoteInput,
  updateInterviewInput,
  completeInterviewInput,
  type InterviewSummaryRow,
} from './index';

describe('createCardInput', () => {
  it('accetta una scheda con il solo titolo (più la colonna)', () => {
    const parsed = createCardInput.parse({ title: '  Barista part-time  ', columnId: 'c1' });
    expect(parsed.title).toBe('Barista part-time');
    expect(parsed.priority).toBe('none');
    expect(parsed.details).toBeUndefined();
  });

  it('rifiuta titolo vuoto o composto solo da spazi', () => {
    expect(createCardInput.safeParse({ title: '   ', columnId: 'c1' }).success).toBe(false);
    expect(createCardInput.safeParse({ columnId: 'c1' }).success).toBe(false);
  });

  it('rifiuta priorità fuori vocabolario', () => {
    expect(
      createCardInput.safeParse({ title: 'x', columnId: 'c1', priority: 'critical' }).success,
    ).toBe(false);
  });

  it.each(['none', 'low', 'medium', 'high', 'urgent'])('accetta la priorità %s', (priority) => {
    expect(createCardInput.safeParse({ title: 'x', columnId: 'c1', priority }).success).toBe(true);
  });
});

describe('applicationDetailsInput', () => {
  it('accetta un oggetto vuoto: nessun campo è obbligatorio', () => {
    expect(applicationDetailsInput.safeParse({}).success).toBe(true);
  });

  it('rifiuta retribuzione minima superiore alla massima', () => {
    const r = applicationDetailsInput.safeParse({ salaryMin: 50_000, salaryMax: 30_000 });
    expect(r.success).toBe(false);
  });

  it('accetta solo URL http(s), scartando schemi pericolosi', () => {
    expect(
      applicationDetailsInput.safeParse({ sourceUrl: 'https://example.com/job/1' }).success,
    ).toBe(true);
    expect(applicationDetailsInput.safeParse({ sourceUrl: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(applicationDetailsInput.safeParse({ sourceUrl: 'data:text/html,hi' }).success).toBe(
      false,
    );
  });

  it('valida le date di calendario, incluse quelle inesistenti', () => {
    expect(applicationDetailsInput.safeParse({ appliedOn: '2026-02-28' }).success).toBe(true);
    expect(applicationDetailsInput.safeParse({ appliedOn: '2026-02-30' }).success).toBe(false);
    expect(applicationDetailsInput.safeParse({ appliedOn: '28/02/2026' }).success).toBe(false);
  });

  it('mantiene fase ed esito come concetti distinti', () => {
    const r = applicationDetailsInput.parse({ stage: 'closed', outcome: 'rejected' });
    expect(r.stage).toBe('closed');
    expect(r.outcome).toBe('rejected');
    expect(applicationDetailsInput.safeParse({ stage: 'rejected' }).success).toBe(false);
  });

  it('richiede un codice valuta ISO a tre lettere maiuscole', () => {
    expect(applicationDetailsInput.safeParse({ currency: 'EUR' }).success).toBe(true);
    expect(applicationDetailsInput.safeParse({ currency: 'euro' }).success).toBe(false);
  });
});

describe('dettagli professionali (M2.1)', () => {
  it('updateCardInput: assente ≠ null; la stringa vuota di un testo equivale a null', () => {
    const parsed = updateCardInput.parse({ company: '   ', location: ' Roma ', workMode: null });
    expect(parsed).toEqual({ company: null, location: 'Roma', workMode: null });
    expect('jobTitle' in parsed).toBe(false);
  });

  it('updateCardInput: tutti i campi professionali sono modificabili, il titolo no a null', () => {
    expect(updateCardInput.safeParse({ title: null }).success).toBe(false);
    const all = updateCardInput.safeParse({
      jobTitle: 'Dev',
      location: 'Torino',
      workMode: 'hybrid',
      contractType: 'permanent',
      salaryMin: 30000,
      salaryMax: 40000,
      currency: 'EUR',
      salaryPeriod: 'year',
      salaryBasis: 'gross',
      source: 'LinkedIn',
      publishedOn: '2026-10-01',
      appliedOn: '2026-10-02',
      stage: 'applied',
      outcome: 'pending',
    });
    expect(all.success).toBe(true);
  });

  it('updateCardInput: nel solo payload si controlla l’intervallo; la valuta spetta al servizio', () => {
    expect(updateCardInput.safeParse({ salaryMin: 10 }).success).toBe(true);
    expect(updateCardInput.safeParse({ salaryMin: 20, salaryMax: 10 }).success).toBe(false);
    expect(updateCardInput.safeParse({ salaryMin: 1.5 }).success).toBe(false);
    expect(updateCardInput.safeParse({ salaryMin: -1 }).success).toBe(false);
    expect(updateCardInput.safeParse({ salaryMax: 3_000_000_000 }).success).toBe(false);
  });

  it('salaryIssues: intervallo e valuta su uno stato completo', () => {
    expect(salaryIssues({})).toEqual([]);
    expect(salaryIssues({ salaryMin: 1, currency: 'EUR' })).toEqual([]);
    expect(salaryIssues({ salaryMin: 1 }).map((i) => i.path)).toEqual(['currency']);
    expect(
      salaryIssues({ salaryMin: 5, salaryMax: 1, currency: 'EUR' }).map((i) => i.path),
    ).toEqual(['salaryMax']);
    expect(salaryIssues({ currency: 'EUR' })).toEqual([]);
    // 0 è un importo valido (non assente).
    expect(salaryIssues({ salaryMin: 0 }).map((i) => i.path)).toEqual(['currency']);
  });

  it('lordo/netto: solo valori noti; null = non specificato', () => {
    expect(updateCardInput.parse({ salaryBasis: null }).salaryBasis).toBeNull();
    expect(updateCardInput.safeParse({ salaryBasis: 'gross' }).success).toBe(true);
    expect(updateCardInput.safeParse({ salaryBasis: 'lordo' }).success).toBe(false);
  });

  it('cardDetailsInput è lo stesso schema di applicationDetailsInput (nessun duplicato)', () => {
    expect(cardDetailsInput).toBe(applicationDetailsInput);
  });
});

describe('workspace, board, column, task', () => {
  it('createWorkspaceInput valida il fuso orario IANA', () => {
    expect(
      createWorkspaceInput.safeParse({ name: 'Ricerca 2026', timezone: 'Europe/Rome' }).success,
    ).toBe(true);
    expect(createWorkspaceInput.safeParse({ name: 'x', timezone: 'Mars/Olympus' }).success).toBe(
      false,
    );
    expect(createWorkspaceInput.parse({ name: 'x' }).timezone).toBe('UTC');
  });

  it('createBoardInput richiede il nome e non accetta colori arbitrari', () => {
    expect(createBoardInput.safeParse({ name: '' }).success).toBe(false);
    expect(createBoardInput.safeParse({ name: 'Ok', color: 'url(javascript:1)' }).success).toBe(
      false,
    );
    expect(createBoardInput.parse({ name: 'Ok' }).color).toBeNull();
  });

  it('createColumnInput accetta una categoria semantica facoltativa', () => {
    expect(createColumnInput.parse({ name: 'Inviate', category: 'applied' }).category).toBe(
      'applied',
    );
    expect(createColumnInput.safeParse({ name: 'x', category: 'boh' }).success).toBe(false);
  });
});

describe('attività (M3 Tasks)', () => {
  const id = 'a1b2c3d4-e5f6-4789-8abc-def012345678'; // UUID (36)
  const valid = { id, title: '  Richiama HR  ' };

  it('createTaskInput: solo titolo, con valori predefiniti e rifilatura', () => {
    const t = createTaskInput.parse(valid);
    expect(t).toMatchObject({ title: 'Richiama HR', kind: 'general', priority: 'none' });
  });
  it('createTaskInput: la scadenza è una DATA di calendario, mai un istante né una data impossibile', () => {
    expect(createTaskInput.safeParse({ ...valid, dueOn: '2026-11-10' }).success).toBe(true);
    expect(createTaskInput.safeParse({ ...valid, dueOn: null }).success).toBe(true);
    for (const bad of [
      '2026-02-30',
      '2027-02-29',
      '10/11/2026',
      '2026-11-10T09:00:00+01:00',
      '2026-1-1',
    ])
      expect(createTaskInput.safeParse({ ...valid, dueOn: bad }).success, bad).toBe(false);
    expect(
      createTaskInput.safeParse({ ...valid, dueAt: '2026-11-10T09:00:00+01:00' }).success,
    ).toBe(false);
  });
  it('createTaskInput: limiti e chiavi sconosciute', () => {
    expect(createTaskInput.safeParse({ ...valid, title: ' ' }).success).toBe(false);
    expect(createTaskInput.safeParse({ ...valid, title: 'x'.repeat(200) }).success).toBe(true);
    expect(createTaskInput.safeParse({ ...valid, title: 'x'.repeat(201) }).success).toBe(false);
    expect(createTaskInput.safeParse({ ...valid, description: 'x'.repeat(2000) }).success).toBe(
      true,
    );
    expect(createTaskInput.safeParse({ ...valid, description: 'x'.repeat(2001) }).success).toBe(
      false,
    );
    expect(createTaskInput.safeParse({ ...valid, kind: 'other' }).success).toBe(false);
    expect(createTaskInput.safeParse({ ...valid, priority: 'meh' }).success).toBe(false);
    expect(createTaskInput.safeParse({ ...valid, workspaceId: 'w' }).success).toBe(false);
    expect(createTaskInput.safeParse({ ...valid, status: 'done' }).success).toBe(false); // lo stato non è scrivibile
  });
  it('createTaskInput: ID del client di 16–48 caratteri (la Timeline ne deriva id con suffisso)', () => {
    expect(createTaskInput.safeParse({ ...valid, id: 'short' }).success).toBe(false);
    expect(createTaskInput.safeParse({ ...valid, id: 'a'.repeat(48) }).success).toBe(true);
    expect(createTaskInput.safeParse({ ...valid, id: 'a'.repeat(49) }).success).toBe(false);
    expect(createTaskInput.safeParse({ ...valid, id: 'a'.repeat(15) + ' ' }).success).toBe(false);
  });
  it('updateTaskInput: expectedUpdatedAt obbligatorio e almeno un campo', () => {
    expect(updateTaskInput.safeParse({ title: 'x' }).success).toBe(false);
    expect(updateTaskInput.safeParse({ expectedUpdatedAt: 5 }).success).toBe(false);
    expect(updateTaskInput.safeParse({ expectedUpdatedAt: 5, dueOn: null }).success).toBe(true);
    expect(updateTaskInput.safeParse({ expectedUpdatedAt: 5, description: null }).success).toBe(
      true,
    );
    expect(updateTaskInput.safeParse({ expectedUpdatedAt: 5, cardId: null }).success).toBe(true);
    expect(updateTaskInput.safeParse({ expectedUpdatedAt: 0, title: 'x' }).success).toBe(false);
    expect(updateTaskInput.safeParse({ expectedUpdatedAt: 5, status: 'done' }).success).toBe(false);
  });
  it('tasksQuery: valori predefiniti e limiti', () => {
    expect(tasksQuery.parse({})).toMatchObject({ view: 'all', limit: 50 });
    expect(tasksQuery.safeParse({ view: 'late' }).success).toBe(false);
    expect(tasksQuery.safeParse({ limit: '0' }).success).toBe(false);
    expect(tasksQuery.safeParse({ limit: '101' }).success).toBe(false);
    expect(tasksQuery.parse({ limit: '100' }).limit).toBe(100);
  });
  it('i comandi di stato non hanno corpo', () => {
    expect(taskCommandInput.safeParse({}).success).toBe(true);
    expect(taskCommandInput.safeParse({ x: 1 }).success).toBe(false);
  });
  it('taskSchema: la risposta non ammette stati inventati', () => {
    const base = {
      id,
      cardId: null,
      card: null,
      title: 't',
      description: null,
      kind: 'general',
      priority: 'none',
      dueOn: null,
      status: 'open',
      completedAt: null,
      cancelledAt: null,
      createdAt: 1,
      updatedAt: 1,
    };
    expect(taskSchema.safeParse(base).success).toBe(true);
    expect(taskSchema.safeParse({ ...base, status: 'late' }).success).toBe(false);
  });
  it('Timeline: la voce derivata da una task è accettata, senza testo libero', () => {
    const entry = {
      id: `${id}:created`,
      source: 'task',
      kind: 'task_created',
      occurredAt: 1,
      entity: { type: 'task', id },
      data: { taskId: id, taskKind: 'follow_up' },
    };
    expect(timelineEntrySchema.safeParse(entry).success).toBe(true);
    expect(timelineEntrySchema.safeParse({ ...entry, kind: 'task_reopened' }).success).toBe(false);
  });
});

describe('Overview — retrocompatibilità del contratto (condizione approvata)', () => {
  // Snapshot dello schema alla baseline 5a0d056: NON si modifica quando il contratto si estende.
  const legacyOverview = z.object({
    workspaceId: z.string().min(1).max(64),
    counts: z.object({
      boards: z.number().int(),
      opportunities: z.number().int(),
      applicationsSubmitted: z.number().int(),
      interviews: z.number().int(),
      openTasks: z.number().int(),
      overdueTasks: z.number().int(),
    }),
    upcomingTasks: z.array(
      z.object({
        id: z.string().min(1).max(64),
        title: z.string(),
        dueAt: z.number().int(),
        cardId: z.string().min(1).max(64).nullable(),
      }),
    ),
  });
  const sample = {
    workspaceId: 'w-1',
    counts: {
      boards: 1,
      opportunities: 2,
      applicationsSubmitted: 1,
      interviews: 0,
      openTasks: 3,
      overdueTasks: 1,
      dueTodayTasks: 1,
      noDueTasks: 1,
    },
    upcomingTasks: [
      { id: 'abc', title: 't', dueAt: 1_700_000_000_000, dueOn: '2026-11-10', cardId: null },
    ],
    recentBoards: [],
    recentCards: [],
  };
  it('una risposta del contratto esteso è valida anche per lo schema della baseline', () => {
    expect(legacyOverview.safeParse(sample).success).toBe(true);
    expect(overviewResponse.safeParse(sample).success).toBe(true);
  });
  it('nessun campo della baseline è stato rimosso o ha cambiato tipo', () => {
    const shape = overviewResponse.shape.counts.shape;
    for (const key of [
      'boards',
      'opportunities',
      'applicationsSubmitted',
      'interviews',
      'openTasks',
      'overdueTasks',
    ])
      expect(Object.keys(shape), key).toContain(key);
    const task = overviewResponse.shape.upcomingTasks.element.shape;
    expect(Object.keys(task)).toEqual(expect.arrayContaining(['id', 'title', 'dueAt', 'cardId']));
    expect(task.dueAt.safeParse(1.5).success).toBe(false); // resta un intero
  });
});

describe('campi personalizzati', () => {
  const def = (input: unknown): CustomFieldDefinitionInput =>
    customFieldDefinitionInput.parse(input);

  const select = def({
    name: 'Livello',
    type: 'single_select',
    config: {
      options: [
        { id: 'jr', label: 'Junior' },
        { id: 'sr', label: 'Senior' },
      ],
    },
  });
  const multi = def({
    name: 'Benefit',
    type: 'multi_select',
    config: {
      options: [
        { id: 'a', label: 'Buoni pasto' },
        { id: 'b', label: 'Formazione' },
      ],
    },
  });

  it('richiede almeno un’opzione nei campi a selezione e ID unici', () => {
    expect(
      customFieldDefinitionInput.safeParse({
        name: 'x',
        type: 'single_select',
        config: { options: [] },
      }).success,
    ).toBe(false);
    expect(
      customFieldDefinitionInput.safeParse({
        name: 'x',
        type: 'multi_select',
        config: {
          options: [
            { id: 'a', label: 'A' },
            { id: 'a', label: 'B' },
          ],
        },
      }).success,
    ).toBe(false);
  });

  it('rifiuta un tipo sconosciuto', () => {
    expect(
      customFieldDefinitionInput.safeParse({ name: 'x', type: 'rating', config: {} }).success,
    ).toBe(false);
  });

  it('valida i valori rispetto al tipo della definizione', () => {
    const text = def({ name: 'Note', type: 'text', config: { maxLength: 5 } });
    expect(validateCustomFieldValue(text, 'ciao').success).toBe(true);
    expect(validateCustomFieldValue(text, 'troppo lungo').success).toBe(false);
    expect(validateCustomFieldValue(text, 42).success).toBe(false);

    const num = def({
      name: 'Km',
      type: 'number',
      config: { min: 0, max: 100, integerOnly: true },
    });
    expect(validateCustomFieldValue(num, 10).success).toBe(true);
    expect(validateCustomFieldValue(num, 10.5).success).toBe(false);
    expect(validateCustomFieldValue(num, 101).success).toBe(false);
    expect(validateCustomFieldValue(num, '10').success).toBe(false);

    expect(
      validateCustomFieldValue(def({ name: 'D', type: 'date', config: {} }), '2026-11-04').success,
    ).toBe(true);
    expect(
      validateCustomFieldValue(def({ name: 'D', type: 'date', config: {} }), '2026-13-01').success,
    ).toBe(false);
    expect(
      validateCustomFieldValue(def({ name: 'B', type: 'boolean', config: {} }), 'true').success,
    ).toBe(false);
    expect(
      validateCustomFieldValue(def({ name: 'U', type: 'url', config: {} }), 'javascript:1').success,
    ).toBe(false);
  });

  it('valida le selezioni contro le opzioni definite', () => {
    expect(validateCustomFieldValue(select, 'jr').success).toBe(true);
    expect(validateCustomFieldValue(select, 'lead').success).toBe(false);
    expect(validateCustomFieldValue(multi, ['a', 'b']).success).toBe(true);
    expect(validateCustomFieldValue(multi, ['a', 'zzz']).success).toBe(false);
    expect(validateCustomFieldValue(multi, ['a', 'a']).success).toBe(false);
  });

  it('accetta null come "campo svuotato" per ogni tipo', () => {
    for (const d of [select, multi]) expect(validateCustomFieldValue(d, null).success).toBe(true);
  });

  it('serializza e rilegge i valori senza perdere il tipo', () => {
    const values: CustomFieldValue[] = [
      'testo',
      42,
      0,
      3.14,
      true,
      false,
      ['a', 'b'],
      [],
      null,
      '2026-11-04',
    ];
    for (const value of values) {
      const roundTripped = parseStoredCustomFieldValue(serializeCustomFieldValue(value));
      expect(roundTripped).toStrictEqual(value);
      expect(typeof roundTripped).toBe(typeof value);
    }
  });
});

describe('contratti M1 (bacheche, colonne, schede)', () => {
  it('createBoardInput: template di default "custom", solo template noti', () => {
    expect(createBoardInput.parse({ name: 'x' }).templateId).toBe('custom');
    expect(createBoardInput.parse({ name: 'x', templateId: 'minimal' }).templateId).toBe('minimal');
    expect(createBoardInput.safeParse({ name: 'x', templateId: 'altro' }).success).toBe(false);
  });

  it.each([
    ['updateBoardInput', updateBoardInput],
    ['updateColumnInput', updateColumnInput],
    ['updateCardInput', updateCardInput],
  ])(
    '%s: richiede almeno un campo e rifiuta campi sconosciuti (nessun mass-assignment)',
    (_n, schema) => {
      expect(schema.safeParse({}).success).toBe(false);
      expect(schema.safeParse({ workspaceId: 'altro', name: 'x', title: 'x' }).success).toBe(false);
      expect(schema.safeParse({ position: 3 }).success).toBe(false);
    },
  );

  it('updateCardInput: modifiche parziali valide, URL solo http(s), null azzera', () => {
    expect(updateCardInput.parse({ description: null }).description).toBeNull();
    expect(updateCardInput.parse({ title: '  Nuovo  ' }).title).toBe('Nuovo');
    expect(updateCardInput.safeParse({ sourceUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(updateCardInput.safeParse({ sourceUrl: 'https://example.com/a' }).success).toBe(true);
    expect(updateCardInput.safeParse({ priority: 'critical' }).success).toBe(false);
    expect(updateCardInput.safeParse({ archivedAt: 1 }).success).toBe(false);
  });

  it('createCardInput: i payload di M1 restano validi; in creazione un importo richiede la valuta', () => {
    const base = { title: 'x', columnId: 'c' };
    expect(createCardInput.safeParse({ ...base, details: { company: 'ACME' } }).success).toBe(true);
    expect(createCardInput.safeParse({ ...base, details: { salaryMin: 1 } }).success).toBe(false);
    expect(
      createCardInput.safeParse({ ...base, details: { salaryMin: 1, currency: 'EUR' } }).success,
    ).toBe(true);
    expect(createCardInput.safeParse({ ...base, details: { sconosciuto: 1 } }).success).toBe(false);
  });

  it('moveInput / moveCardInput: ancora esplicita (null = in cima), nessun indice', () => {
    expect(moveInput.parse({ afterId: null }).afterId).toBeNull();
    expect(moveInput.safeParse({}).success).toBe(false);
    expect(moveInput.safeParse({ afterId: 'a', index: 2 }).success).toBe(false);
    expect(moveCardInput.safeParse({ columnId: 'c', afterCardId: null }).success).toBe(true);
    expect(moveCardInput.safeParse({ columnId: 'c' }).success).toBe(false);
  });

  it('deleteColumnInput: destinazione facoltativa, nient’altro', () => {
    expect(deleteColumnInput.parse({}).moveCardsToColumnId).toBeNull();
    expect(deleteColumnInput.safeParse({ force: true }).success).toBe(false);
  });
});

describe('colloqui (M2.5)', () => {
  const row = (over: Partial<InterviewSummaryRow>): InterviewSummaryRow => ({
    id: 'i',
    sequence: 1,
    title: 'R1',
    type: 'other',
    status: 'to_schedule',
    scheduledAt: null,
    timezone: null,
    modality: null,
    hasFeedback: false,
    ...over,
  });
  const NOW = 1_800_000_000_000;

  it('nessun colloquio: riepilogo vuoto, nessuna azione inventata', () => {
    expect(summarizeInterviews([], NOW)).toEqual({
      total: 0,
      completed: 0,
      next: null,
      action: null,
    });
  });

  it('il prossimo è il primo programmato non trascorso; annullati e passati non lo sono', () => {
    const s = summarizeInterviews(
      [
        row({ id: 'past', sequence: 1, status: 'scheduled', scheduledAt: NOW - 1000 }),
        row({ id: 'cancelled', sequence: 2, status: 'cancelled', scheduledAt: NOW + 1000 }),
        row({ id: 'far', sequence: 3, status: 'scheduled', scheduledAt: NOW + 9000 }),
        row({ id: 'near', sequence: 4, status: 'scheduled', scheduledAt: NOW + 2000 }),
      ],
      NOW,
    );
    expect(s.next?.id).toBe('near');
    expect(s.total).toBe(3); // gli annullati non contano
  });

  it('un colloquio che inizia adesso è ancora «prossimo»', () => {
    expect(
      summarizeInterviews([row({ status: 'scheduled', scheduledAt: NOW })], NOW).next,
    ).not.toBeNull();
  });

  it('priorità della prossima azione: da aggiornare > feedback mancante > da programmare', () => {
    const toSchedule = row({ id: 's', sequence: 3 });
    const feedback = row({ id: 'f', sequence: 2, status: 'completed' });
    const overdue = row({ id: 'o', sequence: 1, status: 'scheduled', scheduledAt: NOW - 5 });
    expect(summarizeInterviews([toSchedule], NOW).action?.kind).toBe('schedule');
    expect(summarizeInterviews([toSchedule, feedback], NOW).action).toMatchObject({
      kind: 'record_feedback',
      interviewId: 'f',
    });
    expect(summarizeInterviews([toSchedule, feedback, overdue], NOW).action).toMatchObject({
      kind: 'overdue',
      interviewId: 'o',
    });
    // Con feedback o esito registrati non c'è nulla da fare.
    expect(
      summarizeInterviews([row({ status: 'completed', hasFeedback: true })], NOW).action,
    ).toBeNull();
    // Un annullato non genera azioni.
    expect(summarizeInterviews([row({ status: 'cancelled' })], NOW).action).toBeNull();
  });

  it("contratti strict: stato, numero d'ordine ed esito non si impostano alla creazione", () => {
    expect(createInterviewInput.parse({}).type).toBe('other');
    for (const bad of [
      { status: 'completed' },
      { sequence: 3 },
      { result: 'positive' },
      { id: 'x' },
    ]) {
      expect(createInterviewInput.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
    expect(updateInterviewInput.safeParse({}).success).toBe(false);
    expect(updateInterviewInput.parse({ preparationNotes: '  ' }).preparationNotes).toBeNull();
    expect(updateInterviewInput.safeParse({ status: 'completed' }).success).toBe(false);
    expect(
      completeInterviewInput.safeParse({ result: 'positive', feedbackNotes: 'ok' }).success,
    ).toBe(true);
    expect(completeInterviewInput.safeParse({ result: 'ottimo' }).success).toBe(false);
  });
});

describe('M3-C2 — pipeline, note, documenti, timeline', () => {
  const id = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';

  it('clientIdSchema: UUID e token sicuri 16–64; rifiuta corti, lunghi, separatori e spazi', () => {
    for (const ok of [id, 'abcdefghijklmnop', 'A_b-c1234567890123']) {
      expect(clientIdSchema.safeParse(ok).success).toBe(true);
    }
    for (const bad of [
      '',
      'corto',
      'a'.repeat(65),
      'con spazio 1234567890',
      "a'b1234567890123456",
      'ünicode1234567890123',
    ]) {
      expect(clientIdSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it('transizione: richiede ID, rifiuta archivio come destinazione, campi sconosciuti e combinazioni incoerenti', () => {
    const ok = pipelineTransitionInput.safeParse({
      id,
      to: 'applied',
      kind: 'advance',
      appliedOn: '2026-11-01',
    });
    expect(ok.success).toBe(true);
    for (const bad of [
      { to: 'applied', kind: 'advance' },
      { id, to: 'archived', kind: 'advance' },
      { id, to: 'applied', kind: 'salta' },
      { id, to: 'applied', kind: 'advance', extra: 1 },
      { id, to: 'applied', kind: 'advance', futureInterviews: 'cancel' },
      { id, to: 'rejected', kind: 'close', appliedOn: '2026-11-01' },
      { id, to: 'applied', kind: 'advance', appliedOn: '01/11/2026' },
    ]) {
      expect(pipelineTransitionInput.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
    expect(
      pipelineTransitionInput.safeParse({
        id,
        to: 'rejected',
        kind: 'close',
        futureInterviews: 'cancel',
      }).success,
    ).toBe(true);
  });

  it('note: testo rifilato, 1–10.000 caratteri, ID obbligatorio, nessun campo extra', () => {
    expect(createNoteInput.parse({ id, body: '  ciao  ' }).body).toBe('ciao');
    expect(createNoteInput.safeParse({ id, body: '   ' }).success).toBe(false);
    expect(createNoteInput.safeParse({ id, body: 'x'.repeat(10_001) }).success).toBe(false);
    expect(createNoteInput.safeParse({ body: 'x' }).success).toBe(false);
    expect(createNoteInput.safeParse({ id, body: 'x', cardId: 'altra' }).success).toBe(false);
    expect(updateNoteInput.safeParse({ body: '' }).success).toBe(false);
  });

  it('documenti: solo http(s), tipo dal vocabolario, nota ≤ 500, nessun contenuto di file', () => {
    expect(createDocumentInput.parse({ id, title: ' CV ' })).toMatchObject({
      title: 'CV',
      kind: 'other',
    });
    for (const url of [
      'javascript:alert(1)',
      'data:text/plain,x',
      'file:///etc/passwd',
      'ftp://x.it',
      'x',
    ]) {
      expect(createDocumentInput.safeParse({ id, title: 't', url }).success, url).toBe(false);
    }
    expect(createDocumentInput.safeParse({ id, title: 't', url: 'https://x.it/a' }).success).toBe(
      true,
    );
    expect(createDocumentInput.safeParse({ id, title: 't', kind: 'exe' }).success).toBe(false);
    expect(createDocumentInput.safeParse({ id, title: 't', content: 'AAAA' }).success).toBe(false);
    expect(updateDocumentInput.safeParse({}).success).toBe(false);
    expect(updateDocumentInput.parse({ note: '' })).toEqual({ note: null });
  });

  it('timeline: limite 1–50 (predefinito 25), cursore opzionale', () => {
    expect(timelineQuery.parse({})).toEqual({ limit: 25 });
    expect(timelineQuery.parse({ limit: '50', before: 'abc' })).toEqual({
      limit: 50,
      before: 'abc',
    });
    for (const limit of ['0', '51', 'x', '1.5'])
      expect(timelineQuery.safeParse({ limit }).success, limit).toBe(false);
  });

  it('colloquio: l’ID del client è facoltativo ma, se presente, validato', () => {
    expect(createInterviewInput.safeParse({}).success).toBe(true);
    expect(createInterviewInput.safeParse({ id }).success).toBe(true);
    expect(createInterviewInput.safeParse({ id: 'x' }).success).toBe(false);
  });
});
