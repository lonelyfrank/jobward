import {
  applicationMutationResponse,
  cardResponse,
  createCardInput,
  type Card,
  type CreateCardInput,
} from '@jobward/schemas';
import {
  CONTRACT_TYPES,
  LIMITS,
  SALARY_PERIODS,
  SENIORITY_LEVELS,
  WORK_MODES,
  localDate,
} from '@jobward/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { derivePipelineStatus } from '@jobward/shared';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { Textarea } from '@/components/ui/textarea';
import {
  invalidateSummaries,
  keys,
  scoped,
  useBoardDetail,
  useBoards,
} from '@/features/boards/api';
import { cardPath } from '@/features/cards/card-path';
import { useDuplicates } from '@/features/companies/api';
import { STATUS_LABELS } from '@/features/pipeline/presentation';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  CONTRACT_LABELS,
  INTEREST_LABELS,
  PERIOD_LABELS,
  SENIORITY_LABELS,
  WORK_MODE_LABELS,
} from '@/lib/labels';
import { useCreateCard, userMessage } from './mutations';

/** Valore del selettore per «nessuna bacheca»: l'opportunità finisce nell'Inbox. */
const INBOX = '';

const STEPS = ['Annuncio', 'Dettagli', 'Valutazione', 'Candidatura'] as const;

type ApplicationChoice = 'none' | 'applied' | 'preparing';

interface Draft {
  title: string;
  company: string;
  sourceUrl: string;
  location: string;
  workMode: string;
  contractType: string;
  seniority: string;
  salaryMin: string;
  salaryMax: string;
  currency: string;
  salaryPeriod: string;
  deadlineOn: string;
  interest: string;
  requirements: string;
  benefits: string;
  description: string;
  application: ApplicationChoice;
  appliedOn: string;
  channel: string;
}

const emptyDraft = (today: string): Draft => ({
  title: '',
  company: '',
  sourceUrl: '',
  location: '',
  workMode: '',
  contractType: '',
  seniority: '',
  salaryMin: '',
  salaryMax: '',
  currency: 'EUR',
  salaryPeriod: '',
  deadlineOn: '',
  interest: '',
  requirements: '',
  benefits: '',
  description: '',
  application: 'none',
  appliedOn: today,
  channel: '',
});

const text = (v: string) => (v.trim() === '' ? undefined : v.trim());
const amount = (v: string) => {
  const t = v.trim().replace(/\s/g, '');
  if (t === '') return undefined;
  const n = /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replaceAll('.', '') : t;
  return /^\d+$/.test(n) ? Number(n) : Number.NaN;
};

/** Bozza → payload di creazione (solo i campi compilati). */
function toInput(draft: Draft, columnId: string | null) {
  const salaryMin = amount(draft.salaryMin);
  const salaryMax = amount(draft.salaryMax);
  const hasSalary = salaryMin !== undefined || salaryMax !== undefined;
  const details = Object.fromEntries(
    Object.entries({
      company: text(draft.company),
      sourceUrl: text(draft.sourceUrl),
      location: text(draft.location),
      workMode: text(draft.workMode),
      contractType: text(draft.contractType),
      seniority: text(draft.seniority),
      salaryMin,
      salaryMax,
      currency: hasSalary ? text(draft.currency)?.toUpperCase() : undefined,
      salaryPeriod: hasSalary ? text(draft.salaryPeriod) : undefined,
      deadlineOn: text(draft.deadlineOn),
      interest: draft.interest ? Number(draft.interest) : undefined,
      requirements: text(draft.requirements),
      benefits: text(draft.benefits),
    }).filter(([, v]) => v !== undefined),
  );
  return createCardInput.safeParse({
    title: draft.title.trim(),
    priority: 'none',
    ...(columnId ? { columnId } : {}),
    ...(text(draft.description) ? { description: text(draft.description) } : {}),
    ...(Object.keys(details).length > 0 ? { details } : {}),
  });
}

/** Primo passo che contiene un campo in errore (per portare l'utente dove serve). */
const STEP_OF: Record<string, number> = {
  title: 0,
  company: 0,
  sourceUrl: 0,
  location: 1,
  workMode: 1,
  contractType: 1,
  seniority: 1,
  salaryMin: 1,
  salaryMax: 1,
  currency: 1,
  salaryPeriod: 1,
  deadlineOn: 1,
  interest: 2,
  requirements: 2,
  benefits: 2,
  description: 2,
};

function useCreateOpportunity() {
  const { workspace } = useWorkspace();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCardInput) =>
      apiRequest(scoped(workspace.id, '/cards'), cardResponse, { method: 'POST', json: input }),
    onSuccess: ({ card }) => {
      invalidateSummaries(client, workspace.id);
      if (card.boardId) {
        void client.invalidateQueries({ queryKey: keys.board(workspace.id, card.boardId) });
      }
    },
  });
}

/**
 * «Nuova opportunità» guidata (B-04, progressive disclosure): quattro passi, tutti facoltativi tranne il
 * titolo, salvabili da qualunque passo. Salvare non significa candidarsi: l'ultimo passo lo chiede.
 */
export function GlobalCreateCardDialog({
  open,
  onOpenChange,
  initialBoardId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialBoardId?: string;
}) {
  const { workspace } = useWorkspace();
  // «Oggi» fissato all'apertura: il render resta puro.
  const [today] = useState(() => localDate(Date.now(), workspace.timezone));
  const boards = useBoards();
  const client = useQueryClient();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(today));
  const [boardId, setBoardId] = useState<string>(initialBoardId ?? INBOX);
  const [columnId, setColumnId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const notify = useNotify();

  const duplicates = useDuplicates({
    title: draft.title,
    company: draft.company,
    sourceUrl: draft.sourceUrl,
  });
  const detail = useBoardDetail(boardId, boardId !== INBOX);
  const createInbox = useCreateOpportunity();
  // In una bacheca si usa la creazione del Kanban: aggiorna subito la bacheca e gli avvisi dei filtri.
  const createPlaced = useCreateCard(boardId);
  const columns = boardId === INBOX ? [] : (detail.data?.columns ?? []);
  const selectedColumnId = columns.some((c) => c.id === columnId)
    ? columnId
    : (columns[0]?.id ?? '');
  const waitingColumns = boardId !== INBOX && selectedColumnId === '';
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const reset = () => {
    setDraft(emptyDraft(today));
    setStep(0);
    setErrors({});
  };

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    if (draft.title.trim() === '') {
      setErrors({ title: 'Scrivi un titolo per l’opportunità.' });
      setStep(0);
      return;
    }
    const parsed = toInput(draft, boardId !== INBOX ? selectedColumnId : null);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path.at(-1));
        next[key] ??= issue.message;
      }
      setErrors(next);
      setStep(Math.min(...Object.keys(next).map((k) => STEP_OF[k] ?? 0)));
      return;
    }
    setErrors({});
    setSaving(true);
    let card: Card;
    try {
      const input = parsed.data;
      card =
        boardId === INBOX
          ? (await createInbox.mutateAsync(input)).card
          : (
              await createPlaced.mutateAsync({
                title: input.title,
                columnId: selectedColumnId,
                ...(input.details ? { details: input.details } : {}),
              })
            ).card;
      // La descrizione non fa parte della creazione rapida del Kanban: la si aggiunge subito dopo.
      if (boardId !== INBOX && input.description) {
        await apiRequest(scoped(workspace.id, `/cards/${card.id}`), cardResponse, {
          method: 'PATCH',
          json: { description: input.description },
        });
      }
    } catch (e) {
      setSaving(false);
      setErrors({ title: userMessage(e, 'Non siamo riusciti a salvare l’opportunità. Riprova.') });
      setStep(0);
      return;
    }
    let applicationNote = '';
    if (draft.application !== 'none') {
      try {
        await apiRequest(
          scoped(workspace.id, `/cards/${card.id}/applications`),
          applicationMutationResponse,
          {
            method: 'POST',
            json: {
              id: crypto.randomUUID(),
              stage: draft.application,
              ...(draft.application === 'applied' && draft.appliedOn
                ? { appliedOn: draft.appliedOn }
                : {}),
              ...(draft.channel.trim() ? { channel: draft.channel.trim() } : {}),
            },
          },
        );
        invalidateSummaries(client, workspace.id);
        if (card.boardId) {
          void client.invalidateQueries({ queryKey: keys.board(workspace.id, card.boardId) });
        }
        applicationNote =
          draft.application === 'applied'
            ? ' e candidatura registrata'
            : ' con una candidatura in preparazione';
      } catch {
        notify(
          'error',
          'Opportunità salvata, ma la candidatura non è stata registrata: aprila e usa «Candidati».',
        );
      }
    }
    setSaving(false);
    onOpenChange(false);
    reset();
    notify(
      'success',
      card.boardId
        ? `Opportunità “${card.title}” creata${applicationNote}.`
        : `Opportunità “${card.title}” salvata nell’Inbox${applicationNote}.`,
      { label: 'Apri', onClick: () => void navigate(cardPath(card)) },
    );
  };

  const field = (key: keyof Draft, label: string, input: ReactNode, hint?: string) => (
    <Field id={`gc-${key}`} label={label} hint={hint} error={errors[key]}>
      {input}
    </Field>
  );
  const textInput = (
    key: keyof Draft,
    props: {
      type?: string;
      placeholder?: string;
      max?: number;
      inputMode?: 'url' | 'numeric';
    } = {},
  ) => (
    <Input
      id={`gc-${key}`}
      type={props.type ?? 'text'}
      value={draft[key]}
      maxLength={props.max ?? LIMITS.nameMax}
      placeholder={props.placeholder}
      autoComplete="off"
      {...(props.inputMode ? { inputMode: props.inputMode } : {})}
      aria-invalid={errors[key] ? true : undefined}
      aria-describedby={errors[key] ? `gc-${key}-error` : undefined}
      onChange={(e) => set(key, e.target.value as never)}
    />
  );
  const select = (
    key: keyof Draft,
    options: readonly { value: string; label: string }[],
    empty = 'Non indicato',
  ) => (
    <Select id={`gc-${key}`} value={draft[key]} onChange={(e) => set(key, e.target.value as never)}>
      <option value="">{empty}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
  const labelled = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
    values.map((value) => ({ value, label: labels[value] }));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title="Nuova opportunità"
      description="Basta il titolo: puoi salvare da qualunque passo e completare il resto quando vuoi."
    >
      <form noValidate onSubmit={(e) => void save(e)} className="flex min-h-0 flex-col">
        <DialogBody className="space-y-4">
          <ol aria-label="Passi" className="flex flex-wrap gap-1.5">
            {STEPS.map((label, index) => (
              <li key={label}>
                <button
                  type="button"
                  aria-current={step === index ? 'step' : undefined}
                  onClick={() => setStep(index)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold transition-colors max-md:min-h-11',
                    step === index
                      ? 'bg-primary-soft text-primary-soft-foreground'
                      : 'text-muted-foreground hover:bg-hover-soft',
                  )}
                >
                  {index + 1}. {label}
                </button>
              </li>
            ))}
          </ol>

          {step === 0 ? (
            <fieldset className="space-y-4">
              <legend className="sr-only">Annuncio</legend>
              {field(
                'title',
                'Titolo',
                textInput('title', { max: LIMITS.titleMax, placeholder: 'Es. Tecnico IT junior' }),
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {field('company', 'Azienda (facoltativa)', textInput('company'))}
                {field(
                  'sourceUrl',
                  'Link all’annuncio (facoltativo)',
                  textInput('sourceUrl', {
                    type: 'url',
                    inputMode: 'url',
                    max: LIMITS.urlMax,
                    placeholder: 'https://',
                  }),
                )}
              </div>
              {open && (duplicates.data?.length ?? 0) > 0 ? (
                <div
                  role="status"
                  className="rounded-lg border border-warning-soft bg-warning-soft/50 p-3 text-sm"
                >
                  <p className="font-medium">Forse l’hai già salvata:</p>
                  <ul className="mt-1 space-y-1">
                    {duplicates.data!.map((d) => (
                      <li key={d.id}>
                        <a
                          href={cardPath({ id: d.id, boardId: d.boardId })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium underline underline-offset-2"
                        >
                          {d.title}
                        </a>
                        {d.company ? ` · ${d.company}` : ''}
                        {' · '}
                        {d.archived
                          ? 'archiviata'
                          : d.stage === null
                            ? 'da candidare'
                            : STATUS_LABELS[
                                derivePipelineStatus({
                                  stage: d.stage,
                                  outcome: d.outcome,
                                  archivedAt: null,
                                })
                              ].toLowerCase()}
                        <span className="text-muted-foreground">
                          {d.reason === 'same_url'
                            ? ' (stesso link)'
                            : d.reason === 'same_company_similar_title'
                              ? ' (stessa azienda, titolo simile)'
                              : ' (stesso titolo)'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Puoi salvarla comunque: nulla viene unito automaticamente.
                  </p>
                </div>
              ) : null}
              <div className={cn('grid gap-4', boardId !== INBOX && 'sm:grid-cols-2')}>
                <Field
                  id="gc-board"
                  label="Bacheca"
                  hint="Facoltativa: puoi organizzarla in una bacheca anche dopo."
                >
                  <Select
                    id="gc-board"
                    value={boardId}
                    aria-describedby="gc-board-hint"
                    onChange={(e) => setBoardId(e.target.value)}
                  >
                    <option value={INBOX}>Nessuna bacheca (Inbox)</option>
                    {(boards.data ?? []).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                {boardId !== INBOX ? (
                  <Field id="gc-column" label="Colonna">
                    <Select
                      id="gc-column"
                      value={selectedColumnId}
                      disabled={columns.length === 0}
                      onChange={(e) => setColumnId(e.target.value)}
                    >
                      {columns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
              </div>
              {boardId !== INBOX && detail.data && columns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Questa bacheca non ha colonne: scegli «Nessuna bacheca» oppure aggiungi una
                  colonna.
                </p>
              ) : null}
            </fieldset>
          ) : null}

          {step === 1 ? (
            <fieldset className="space-y-4">
              <legend className="sr-only">Dettagli</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                {field('location', 'Sede', textInput('location'))}
                {field(
                  'workMode',
                  'Modalità',
                  select('workMode', labelled(WORK_MODES, WORK_MODE_LABELS)),
                )}
                {field(
                  'contractType',
                  'Contratto',
                  select('contractType', labelled(CONTRACT_TYPES, CONTRACT_LABELS)),
                )}
                {field(
                  'seniority',
                  'Livello di esperienza',
                  select('seniority', labelled(SENIORITY_LEVELS, SENIORITY_LABELS)),
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                {field(
                  'salaryMin',
                  'RAL minima',
                  textInput('salaryMin', { inputMode: 'numeric', max: 12 }),
                )}
                {field(
                  'salaryMax',
                  'RAL massima',
                  textInput('salaryMax', { inputMode: 'numeric', max: 12 }),
                )}
                {field('currency', 'Valuta', textInput('currency', { max: 3 }))}
                {field(
                  'salaryPeriod',
                  'Periodicità',
                  select('salaryPeriod', labelled(SALARY_PERIODS, PERIOD_LABELS), 'Non indicata'),
                )}
              </div>
              {field(
                'deadlineOn',
                'Scadenza dell’annuncio',
                textInput('deadlineOn', { type: 'date' }),
              )}
            </fieldset>
          ) : null}

          {step === 2 ? (
            <fieldset className="space-y-4">
              <legend className="sr-only">Valutazione</legend>
              {field(
                'interest',
                'Il tuo interesse',
                select(
                  'interest',
                  ([1, 2, 3, 4, 5] as const).map((v) => ({
                    value: String(v),
                    label: INTEREST_LABELS[v],
                  })),
                  'Non valutato',
                ),
                'Una tua valutazione personale, mai calcolata.',
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {field(
                  'requirements',
                  'Requisiti',
                  <Textarea
                    id="gc-requirements"
                    value={draft.requirements}
                    maxLength={LIMITS.descriptionMax}
                    className="min-h-24"
                    onChange={(e) => set('requirements', e.target.value)}
                  />,
                )}
                {field(
                  'benefits',
                  'Benefit',
                  <Textarea
                    id="gc-benefits"
                    value={draft.benefits}
                    maxLength={LIMITS.descriptionMax}
                    className="min-h-24"
                    onChange={(e) => set('benefits', e.target.value)}
                  />,
                )}
              </div>
              {field(
                'description',
                'Note',
                <Textarea
                  id="gc-description"
                  value={draft.description}
                  maxLength={LIMITS.descriptionMax}
                  className="min-h-24"
                  onChange={(e) => set('description', e.target.value)}
                />,
              )}
            </fieldset>
          ) : null}

          {step === 3 ? (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Ti sei già candidato?</legend>
              {(
                [
                  ['none', 'No, per ora la salvo', 'Resta tra le opportunità da valutare.'],
                  [
                    'applied',
                    'Sì, ho già inviato la candidatura',
                    'Registra la data e il canale d’invio.',
                  ],
                  ['preparing', 'La sto preparando', 'Crea una candidatura «in preparazione».'],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3',
                    draft.application === value && 'border-primary bg-primary-soft/40',
                  )}
                >
                  <input
                    type="radio"
                    name="gc-application"
                    value={value}
                    checked={draft.application === value}
                    onChange={() => set('application', value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                </label>
              ))}
              {draft.application === 'applied' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {field('appliedOn', 'Data d’invio', textInput('appliedOn', { type: 'date' }))}
                  {field(
                    'channel',
                    'Canale',
                    textInput('channel', {
                      max: 120,
                      placeholder: 'Sito aziendale, portale, email…',
                    }),
                  )}
                </div>
              ) : null}
            </fieldset>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? onOpenChange(false) : setStep(step - 1))}
          >
            {step === 0 ? 'Annulla' : 'Indietro'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="secondary" onClick={() => setStep(step + 1)}>
              Avanti
            </Button>
          ) : null}
          <Button type="submit" disabled={saving || waitingColumns}>
            {saving ? 'Salvo…' : 'Salva opportunità'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
