import { newId, type Database } from '@jobward/database';
import {
  completeInterviewInput,
  createBoardInput,
  createCardInput,
  createInterviewInput,
  createLabelInput,
  createNoteInput,
  createSavedViewInput,
  createTaskInput,
  pipelineTransitionInput,
  type ApplicationDetailsInput,
  type Workspace,
} from '@jobward/schemas';
import {
  addDays,
  localDate,
  startOfLocalDay,
  type InterviewModality,
  type InterviewResult,
  type InterviewType,
  type Priority,
  type Stage,
  type TaskKind,
} from '@jobward/shared';
import type { AuthUser } from '../env';
import { createApplication } from './applications';
import { createBoard } from './boards';
import { createCard } from './cards';
import { completeInterview, createInterview } from './interviews';
import { assignLabel, createLabel } from './labels';
import { createNote } from './notes';
import { transitionCard } from './pipeline';
import { createSavedView } from './saved-views';
import { changeTaskState, createTask } from './tasks';
import { createWorkspace } from './workspaces';

/**
 * Dati dimostrativi del profilo «demo» (solo sviluppo locale, vedi `middleware/auth.ts`).
 *
 * Il dataset è costruito con i SERVIZI dell'applicazione, non con INSERT diretti: valgono gli stessi
 * invarianti, eventi di cronologia e snapshot dell'uso reale. Le date sono RELATIVE al momento della
 * generazione (colloqui nei prossimi giorni, candidature delle ultime settimane), così Overview,
 * Calendario e Insights restano significativi in qualunque giorno si faccia la demo.
 * Aziende e persone sono inventate.
 */

const TIMEZONE = 'Europe/Rome';
const HOUR = 3_600_000;

type OpenStep = 'screening' | 'interviewing' | 'offer';
type CloseStep = 'rejected' | 'withdrawn' | 'no_response' | 'hired';

interface InterviewSpec {
  title: string;
  type: InterviewType;
  modality: InterviewModality;
  /** Giorni fa (svolto) oppure, se negativo, tra quanti giorni. `null` = da programmare. */
  daysAgo: number | null;
  hour?: number;
  durationMinutes?: number;
  interviewers?: string[];
  location?: string;
  preparationNotes?: string;
  /** Solo per i colloqui passati: esito e feedback alla conclusione. */
  result?: InterviewResult;
  feedback?: string;
}

interface TaskSpec {
  title: string;
  kind: TaskKind;
  priority?: Priority;
  /** Scadenza relativa a oggi (negativo = scaduta). */
  dueInDays: number | null;
  description?: string;
  done?: boolean;
}

interface OpportunitySpec {
  title: string;
  board: 'main' | 'abroad' | null;
  /** Fase della colonna in cui sta la scheda (le colonne del template hanno una fase). */
  column?: Stage;
  priority?: Priority;
  details: ApplicationDetailsInput;
  labels?: LabelKey[];
  createdDaysAgo: number;
  /** Candidatura in preparazione, non ancora inviata. */
  preparing?: boolean;
  appliedDaysAgo?: number;
  channel?: string;
  steps?: { to: OpenStep | CloseStep; daysAgo: number }[];
  interviews?: InterviewSpec[];
  notes?: { body: string; daysAgo: number }[];
  tasks?: TaskSpec[];
}

const LABELS = [
  { key: 'remote', name: 'Remoto', color: 'green' },
  { key: 'top', name: 'Preferita', color: 'rose' },
  { key: 'referral', name: 'Referral', color: 'violet' },
  { key: 'startup', name: 'Startup', color: 'amber' },
] as const;
type LabelKey = (typeof LABELS)[number]['key'];

const eur = (min: number, max: number) =>
  ({
    salaryMin: min,
    salaryMax: max,
    currency: 'EUR',
    salaryPeriod: 'year',
    salaryBasis: 'gross',
  }) as const;

const OPPORTUNITIES: OpportunitySpec[] = [
  {
    title: 'Full Stack Engineer',
    board: 'main',
    column: 'interviewing',
    priority: 'high',
    labels: ['top'],
    details: {
      company: 'Brera Digital',
      jobTitle: 'Full Stack Engineer (TypeScript)',
      location: 'Via Solferino, Milano (Brera)',
      workMode: 'hybrid',
      contractType: 'permanent',
      ...eur(42_000, 50_000),
      source: 'LinkedIn',
      seniority: 'mid',
      interest: 5,
      benefits: 'Buoni pasto, 2 giorni di smart working, budget formazione',
    },
    createdDaysAgo: 38,
    appliedDaysAgo: 36,
    channel: 'Sito aziendale',
    steps: [
      { to: 'screening', daysAgo: 31 },
      { to: 'interviewing', daysAgo: 27 },
      { to: 'offer', daysAgo: 4 },
    ],
    interviews: [
      {
        title: 'Chiamata con HR',
        type: 'screening',
        modality: 'phone',
        daysAgo: 29,
        hour: 11,
        durationMinutes: 30,
        interviewers: ['Sara Colombo'],
        result: 'positive',
        feedback: 'Molto interessati al progetto sul nuovo checkout.',
      },
      {
        title: 'Colloquio tecnico',
        type: 'technical',
        modality: 'video',
        daysAgo: 21,
        hour: 15,
        durationMinutes: 75,
        interviewers: ['Luca Ferri', 'Anna Riva'],
        result: 'positive',
        feedback: 'Live coding su React e domande su API REST. Bene la parte di testing.',
      },
      {
        title: 'Incontro finale con il CTO',
        type: 'final',
        modality: 'onsite',
        daysAgo: 9,
        hour: 10,
        durationMinutes: 60,
        location: 'Via Solferino, Milano (Brera)',
        interviewers: ['Marco Galli'],
        result: 'positive',
        feedback: 'Discussione su roadmap e team. Offerta in arrivo entro la settimana.',
      },
    ],
    notes: [
      {
        body: 'Offerta ricevuta: 47k RAL + welfare. Chiedere chiarimenti sui giorni di smart working prima di rispondere.',
        daysAgo: 4,
      },
    ],
    tasks: [
      {
        title: 'Rispondere all’offerta di Brera Digital',
        kind: 'follow_up',
        priority: 'urgent',
        dueInDays: 2,
        description: 'Confrontare con le altre candidature aperte prima di decidere.',
      },
    ],
  },
  {
    title: 'Frontend Developer React',
    board: 'main',
    column: 'interviewing',
    priority: 'high',
    labels: ['top', 'referral'],
    details: {
      company: 'Nordlight Software',
      jobTitle: 'Frontend Developer',
      location: 'Via Gaetano de Castillia, Milano (Isola)',
      workMode: 'hybrid',
      contractType: 'permanent',
      ...eur(36_000, 42_000),
      source: 'Referral',
      seniority: 'mid',
      interest: 5,
      requirements: 'React, TypeScript, testing (Vitest/Playwright), accessibilità',
    },
    createdDaysAgo: 26,
    appliedDaysAgo: 24,
    channel: 'Referral interno',
    steps: [
      { to: 'screening', daysAgo: 19 },
      { to: 'interviewing', daysAgo: 15 },
    ],
    interviews: [
      {
        title: 'Primo colloquio conoscitivo',
        type: 'screening',
        modality: 'video',
        daysAgo: 16,
        hour: 9,
        durationMinutes: 45,
        interviewers: ['Elena Fontana'],
        result: 'positive',
        feedback: 'Buona impressione, team di 6 persone. Prossimo step tecnico.',
      },
      {
        title: 'Colloquio tecnico',
        type: 'technical',
        modality: 'video',
        daysAgo: -2,
        hour: 10,
        durationMinutes: 90,
        interviewers: ['Paolo Greco', 'Chiara Moretti'],
        preparationNotes:
          'Ripassare gestione dello stato, performance del rendering e test di componenti.',
      },
    ],
    tasks: [
      {
        title: 'Preparare il colloquio tecnico con Nordlight',
        kind: 'preparation',
        priority: 'high',
        dueInDays: 1,
      },
    ],
    notes: [
      {
        body: 'Referral di Davide (ex collega). Il team usa React 19 e un design system interno.',
        daysAgo: 25,
      },
    ],
  },
  {
    title: 'Tecnico IT – Help Desk e Infrastruttura',
    board: 'main',
    column: 'interviewing',
    details: {
      company: 'Sistemi Alpini',
      location: 'Viale Sarca, Milano (Bicocca)',
      workMode: 'onsite',
      contractType: 'permanent',
      ...eur(28_000, 32_000),
      source: 'InfoJobs',
      seniority: 'junior',
      interest: 3,
    },
    createdDaysAgo: 15,
    appliedDaysAgo: 14,
    steps: [
      { to: 'screening', daysAgo: 9 },
      { to: 'interviewing', daysAgo: 5 },
    ],
    interviews: [
      {
        title: 'Colloquio in sede',
        type: 'behavioral',
        modality: 'onsite',
        daysAgo: -6,
        hour: 14,
        durationMinutes: 60,
        location: 'Viale Sarca, Milano (Bicocca)',
        interviewers: ['Giorgio Pellegrini'],
      },
    ],
  },
  {
    title: 'Backend Engineer Node.js',
    board: 'main',
    column: 'in_contact',
    labels: ['remote', 'startup'],
    details: {
      company: 'Fintech Navigli',
      location: 'Ripa di Porta Ticinese, Milano (Navigli)',
      workMode: 'remote',
      contractType: 'permanent',
      ...eur(40_000, 48_000),
      source: 'Welcome to the Jungle',
      seniority: 'mid',
      interest: 4,
    },
    createdDaysAgo: 12,
    appliedDaysAgo: 10,
    steps: [{ to: 'screening', daysAgo: 6 }],
    interviews: [
      {
        title: 'Chiamata con il recruiter',
        type: 'screening',
        modality: 'phone',
        daysAgo: null,
        interviewers: ['Federica Rinaldi'],
      },
    ],
    tasks: [
      {
        title: 'Proporre una data per la chiamata con Fintech Navigli',
        kind: 'follow_up',
        priority: 'medium',
        dueInDays: 0,
      },
    ],
  },
  {
    title: 'UX Engineer',
    board: 'main',
    column: 'applied',
    details: {
      company: 'Studio Vela',
      location: 'Via Tortona, Milano (Tortona)',
      workMode: 'hybrid',
      contractType: 'fixed_term',
      ...eur(32_000, 36_000),
      source: 'Sito aziendale',
      seniority: 'mid',
      interest: 4,
    },
    createdDaysAgo: 8,
    appliedDaysAgo: 7,
    channel: 'Email',
    tasks: [
      {
        title: 'Follow-up con Studio Vela se non rispondono',
        kind: 'follow_up',
        dueInDays: 5,
      },
    ],
  },
  {
    title: 'DevOps Engineer Junior',
    board: 'main',
    column: 'applied',
    labels: ['remote'],
    details: {
      company: 'Cloudnova',
      location: 'Via Gattamelata, Milano (Portello)',
      workMode: 'remote',
      contractType: 'permanent',
      source: 'LinkedIn',
      seniority: 'junior',
      interest: 3,
    },
    createdDaysAgo: 4,
    appliedDaysAgo: 3,
  },
  {
    title: 'Frontend Developer Vue',
    board: 'main',
    column: 'preparing',
    priority: 'medium',
    details: {
      company: 'Lumen Health',
      location: 'Via Celoria, Milano (Città Studi)',
      workMode: 'hybrid',
      contractType: 'permanent',
      ...eur(34_000, 40_000),
      source: 'Indeed',
      seniority: 'mid',
      interest: 4,
    },
    createdDaysAgo: 3,
    preparing: true,
    tasks: [
      {
        title: 'Adattare CV e lettera per Lumen Health',
        kind: 'preparation',
        priority: 'medium',
        dueInDays: 2,
      },
    ],
  },
  {
    title: 'Product Engineer',
    board: 'main',
    column: 'saved',
    labels: ['startup'],
    details: {
      company: 'Orbita Labs',
      location: 'Via Ventura, Milano (Lambrate)',
      workMode: 'hybrid',
      contractType: 'permanent',
      ...eur(45_000, 55_000),
      source: 'LinkedIn',
      seniority: 'senior',
      interest: 4,
    },
    createdDaysAgo: 2,
  },
  {
    title: 'Junior Web Developer',
    board: 'main',
    column: 'saved',
    details: {
      company: 'Officine Dati',
      location: 'Via Durando, Milano (Bovisa)',
      workMode: 'onsite',
      contractType: 'apprenticeship',
      source: 'Indeed',
      seniority: 'junior',
      interest: 2,
    },
    createdDaysAgo: 5,
  },
  {
    title: 'Data Analyst',
    board: 'main',
    column: 'closed',
    details: {
      company: 'Arcobaleno Retail',
      location: 'Corso Lodi, Milano (Porta Romana)',
      workMode: 'onsite',
      contractType: 'permanent',
      ...eur(30_000, 34_000),
      source: 'LinkedIn',
      seniority: 'junior',
      interest: 3,
    },
    createdDaysAgo: 44,
    appliedDaysAgo: 42,
    steps: [
      { to: 'screening', daysAgo: 37 },
      { to: 'interviewing', daysAgo: 34 },
      { to: 'rejected', daysAgo: 24 },
    ],
    interviews: [
      {
        title: 'Caso pratico su SQL',
        type: 'technical',
        modality: 'video',
        daysAgo: 30,
        hour: 16,
        durationMinutes: 60,
        result: 'negative',
        feedback: 'Cercano più esperienza con strumenti di BI. Feedback utile per i prossimi.',
      },
    ],
  },
  {
    title: 'Mobile Developer Flutter',
    board: 'main',
    column: 'closed',
    details: {
      company: 'Pixel Ponte',
      location: 'Via Padova, Milano (NoLo)',
      workMode: 'hybrid',
      source: 'Indeed',
      interest: 2,
    },
    createdDaysAgo: 48,
    appliedDaysAgo: 46,
    steps: [{ to: 'no_response', daysAgo: 12 }],
  },
  {
    title: 'QA Automation Engineer',
    board: 'main',
    column: 'closed',
    details: {
      company: 'Verdi Logistica',
      location: 'Via Rogoredo, Milano (Santa Giulia)',
      workMode: 'onsite',
      contractType: 'fixed_term',
      source: 'Sito aziendale',
      interest: 2,
    },
    createdDaysAgo: 33,
    appliedDaysAgo: 32,
    steps: [
      { to: 'screening', daysAgo: 28 },
      { to: 'withdrawn', daysAgo: 22 },
    ],
    notes: [
      {
        body: 'Ritirata: sede a Rogoredo troppo scomoda da raggiungere per un contratto a termine.',
        daysAgo: 22,
      },
    ],
  },
  {
    title: 'Frontend Engineer',
    board: 'abroad',
    column: 'applied',
    labels: ['remote'],
    details: {
      company: 'Alpenrise',
      location: 'Zurigo',
      workMode: 'remote',
      contractType: 'permanent',
      salaryMin: 95_000,
      salaryMax: 110_000,
      currency: 'CHF',
      salaryPeriod: 'year',
      salaryBasis: 'gross',
      source: 'Arc',
      seniority: 'mid',
      interest: 4,
    },
    createdDaysAgo: 18,
    appliedDaysAgo: 17,
    channel: 'Portale candidature',
  },
  {
    title: 'Software Engineer, Web Platform',
    board: 'abroad',
    column: 'saved',
    details: {
      company: 'Kestrel Labs',
      location: 'Berlino',
      workMode: 'hybrid',
      contractType: 'permanent',
      ...eur(60_000, 72_000),
      source: 'LinkedIn',
      seniority: 'mid',
      interest: 3,
    },
    createdDaysAgo: 6,
  },
  {
    title: 'React Developer',
    board: null,
    details: {
      company: 'Agenzia Riva',
      location: 'Corso Sempione, Milano (Sempione)',
      workMode: 'hybrid',
      source: 'LinkedIn',
    },
    createdDaysAgo: 1,
  },
  {
    title: 'Frontend Engineer – Design System',
    board: null,
    labels: ['remote'],
    details: {
      company: 'Nimbus Travel',
      location: 'Via Washington, Milano (De Angeli)',
      workMode: 'remote',
      source: 'Newsletter',
    },
    createdDaysAgo: 1,
  },
];

const GENERAL_TASKS: TaskSpec[] = [
  { title: 'Aggiornare il profilo LinkedIn', kind: 'general', dueInDays: 0, priority: 'low' },
  { title: 'Rivedere il portfolio con i progetti recenti', kind: 'general', dueInDays: 6 },
  {
    title: 'Scrivere a Davide per ringraziarlo del referral',
    kind: 'general',
    dueInDays: -3,
    done: true,
  },
];

const SAVED_VIEWS = [
  { name: 'Da remoto', params: 'mode=remote' },
  {
    name: 'Candidature attive',
    params: 'vista=applications&stage=applied,in_contact,interviewing,offer',
  },
];

/** Elimina e rigenera il workspace dell'utente demo. Mai chiamata per l'identità reale (vedi la rotta). */
export async function resetDemoWorkspace(
  d1: D1Database,
  db: Database,
  user: AuthUser,
  now: number,
): Promise<Workspace> {
  // Le tabelle di dominio dipendono dal workspace con ON DELETE CASCADE: si eliminano solo i suoi dati.
  await d1
    .prepare(
      `DELETE FROM workspaces WHERE id IN
         (SELECT workspace_id FROM workspace_members WHERE user_id = ?1 AND role = 'owner')`,
    )
    .bind(user.id)
    .run();

  const today = localDate(now, TIMEZONE);
  /** Istante «giorni fa, all'ora indicata» (negativo = futuro); il passato non supera mai `now`. */
  const at = (daysAgo: number, hour: number) => {
    const instant = startOfLocalDay(addDays(today, -daysAgo), TIMEZONE) + hour * HOUR;
    return daysAgo >= 0 ? Math.min(instant, now - 60_000) : instant;
  };
  const dateAgo = (daysAgo: number) => addDays(today, -daysAgo);

  const first = OPPORTUNITIES.reduce((max, o) => Math.max(max, o.createdDaysAgo), 0) + 1;
  const workspace = await createWorkspace(
    d1,
    user,
    { name: 'Ricerca lavoro', timezone: TIMEZONE },
    at(first, 9),
  );
  const ws = workspace.id;

  const boards = {
    main: await createBoard(
      d1,
      ws,
      createBoardInput.parse({
        name: 'Ricerca 2026',
        description: 'Le candidature principali in Italia',
        templateId: 'job-search-standard',
        backgroundImage: 'alps',
      }),
      at(first, 9),
    ),
    abroad: await createBoard(
      d1,
      ws,
      createBoardInput.parse({
        name: 'Estero e remoto',
        description: 'Opportunità fuori dall’Italia',
        templateId: 'job-search-standard',
        backgroundImage: 'misty-fjord',
      }),
      at(20, 9),
    ),
  };

  const labelIds = {} as Record<LabelKey, string>;
  for (const label of LABELS) {
    const created = await createLabel(
      d1,
      db,
      ws,
      createLabelInput.parse({ name: label.name, color: label.color }),
      at(first, 10),
    );
    labelIds[label.key] = created.id;
  }

  // Azioni di tutte le opportunità, eseguite in ordine cronologico come le avrebbe fatte l'utente.
  const actions: { at: number; order: number; run: () => Promise<unknown> }[] = [];
  const schedule = (time: number, run: () => Promise<unknown>) =>
    actions.push({ at: time, order: actions.length, run });

  const taskAction = (task: TaskSpec, cardId: string | null, createdAt: number) => {
    const id = newId();
    schedule(createdAt, () =>
      createTask(
        d1,
        db,
        ws,
        createTaskInput.parse({
          id,
          title: task.title,
          kind: task.kind,
          priority: task.priority ?? 'none',
          dueOn: task.dueInDays === null ? null : addDays(today, task.dueInDays),
          description: task.description,
          cardId,
        }),
        createdAt,
      ),
    );
    if (task.done) {
      schedule(Math.min(createdAt + 26 * HOUR, now - 60_000), () =>
        changeTaskState(d1, db, ws, id, 'complete', Math.min(createdAt + 26 * HOUR, now - 60_000)),
      );
    }
  };

  for (const spec of OPPORTUNITIES) {
    const created = at(spec.createdDaysAgo, 9);
    const board = spec.board ? boards[spec.board] : null;
    const column = board?.columns.find((c) => c.category === spec.column) ?? null;
    const card = await createCard(
      d1,
      db,
      ws,
      user.id,
      createCardInput.parse({
        title: spec.title,
        columnId: column?.id ?? null,
        priority: spec.priority ?? 'none',
        details: spec.details,
      }),
      created,
    );

    for (const key of spec.labels ?? []) {
      schedule(created + 60_000, () =>
        assignLabel(d1, db, ws, card.id, labelIds[key], created + 60_000),
      );
    }
    if (spec.preparing) {
      schedule(created + HOUR, () =>
        createApplication(
          d1,
          db,
          ws,
          user.id,
          card.id,
          { id: newId(), stage: 'preparing' },
          created + HOUR,
        ),
      );
    }
    if (spec.appliedDaysAgo !== undefined) {
      const appliedAt = at(spec.appliedDaysAgo, 10);
      const input = {
        id: newId(),
        stage: 'applied' as const,
        appliedOn: dateAgo(spec.appliedDaysAgo),
        channel: spec.channel ?? null,
      };
      schedule(appliedAt, () => createApplication(d1, db, ws, user.id, card.id, input, appliedAt));
    }
    for (const step of spec.steps ?? []) {
      const time = at(step.daysAgo, 12);
      const kind = ['screening', 'interviewing', 'offer'].includes(step.to) ? 'advance' : 'close';
      schedule(time, () =>
        transitionCard(
          d1,
          db,
          ws,
          user.id,
          card.id,
          pipelineTransitionInput.parse({ id: newId(), to: step.to, kind }),
          time,
        ),
      );
    }
    for (const interview of spec.interviews ?? []) {
      const scheduledAt =
        interview.daysAgo === null ? null : at(interview.daysAgo, interview.hour ?? 10);
      // Il colloquio si registra qualche giorno prima di svolgerlo (mai prima dell'invio).
      const base = spec.appliedDaysAgo ?? spec.createdDaysAgo;
      const createdDaysAgo =
        interview.daysAgo === null
          ? Math.min(base, 5)
          : Math.min(base, Math.max(interview.daysAgo + 3, 1));
      const createdAt = at(createdDaysAgo, 17);
      const id = newId();
      schedule(createdAt, () =>
        createInterview(
          d1,
          db,
          ws,
          user.id,
          card.id,
          createInterviewInput.parse({
            id,
            title: interview.title,
            type: interview.type,
            scheduledAt,
            timezone: TIMEZONE,
            durationMinutes: interview.durationMinutes ?? null,
            modality: interview.modality,
            location: interview.location,
            meetingUrl: interview.modality === 'video' ? 'https://meet.example.com/demo' : null,
            interviewers: interview.interviewers ?? [],
            preparationNotes: interview.preparationNotes,
          }),
          createdAt,
        ),
      );
      if (scheduledAt !== null && interview.daysAgo !== null && interview.daysAgo > 0) {
        const completedAt = scheduledAt + (interview.durationMinutes ?? 60) * 60_000;
        schedule(completedAt, () =>
          completeInterview(
            d1,
            db,
            ws,
            user.id,
            id,
            completeInterviewInput.parse({
              result: interview.result ?? null,
              feedbackNotes: interview.feedback,
              completedAt,
            }),
            completedAt,
          ),
        );
      }
    }
    for (const note of spec.notes ?? []) {
      const time = at(note.daysAgo, 18);
      schedule(time, () =>
        createNote(
          d1,
          db,
          ws,
          card.id,
          createNoteInput.parse({ id: newId(), body: note.body }),
          time,
        ),
      );
    }
    for (const task of spec.tasks ?? []) {
      taskAction(task, card.id, at(Math.min(spec.createdDaysAgo, 2), 19));
    }
  }
  for (const task of GENERAL_TASKS) taskAction(task, null, at(5, 8));

  actions.sort((a, b) => a.at - b.at || a.order - b.order);
  for (const action of actions) await action.run();

  for (const view of SAVED_VIEWS) {
    await createSavedView(d1, db, ws, createSavedViewInput.parse(view), now - 60_000);
  }
  return workspace;
}
