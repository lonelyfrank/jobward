import {
  createInterviewInput,
  updateInterviewInput,
  type CreateInterviewInput,
  type Interview,
  type UpdateInterviewInput,
} from '@jobward/schemas';
import {
  INTERVIEW_MODALITIES,
  INTERVIEW_TYPES,
  LIMITS,
  type InterviewModality,
  type InterviewType,
} from '@jobward/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useDirtyReporter } from '@/features/cards/dirty-guard';
import { ApiRequestError } from '@/lib/api';
import { INTERVIEW_MODALITY_LABELS, INTERVIEW_TYPE_LABELS } from '@/lib/labels';
import { instantToLocalInput, localInputToInstant, timeZoneOptions } from './time';

interface Draft {
  title: string;
  type: InterviewType;
  local: string;
  timezone: string;
  duration: string;
  modality: string;
  location: string;
  meetingUrl: string;
  interviewers: string;
  preparationNotes: string;
}

type Errors = Partial<Record<keyof Draft | 'form', string>>;

const FIELD_OF_PATH: Record<string, keyof Draft> = {
  title: 'title',
  type: 'type',
  scheduledAt: 'local',
  timezone: 'timezone',
  durationMinutes: 'duration',
  modality: 'modality',
  location: 'location',
  meetingUrl: 'meetingUrl',
  interviewers: 'interviewers',
  preparationNotes: 'preparationNotes',
};

const nullable = (v: string) => (v.trim() === '' ? null : v.trim());

function initial(interview: Interview | null, zone: string): Draft {
  const timezone = interview?.timezone ?? zone;
  return {
    title: interview?.title ?? '',
    type: interview?.type ?? 'other',
    local:
      interview?.scheduledAt != null ? instantToLocalInput(interview.scheduledAt, timezone) : '',
    timezone,
    duration: interview?.durationMinutes != null ? String(interview.durationMinutes) : '',
    modality: interview?.modality ?? '',
    location: interview?.location ?? '',
    meetingUrl: interview?.meetingUrl ?? '',
    interviewers: (interview?.interviewers ?? []).join('\n'),
    preparationNotes: interview?.preparationNotes ?? '',
  };
}

/** Valori tipizzati della bozza (null = vuoto); errori locali di formato (data, durata). */
function typed(draft: Draft, errors: Errors) {
  let scheduledAt: number | null = null;
  if (draft.local) {
    scheduledAt = localInputToInstant(draft.local, draft.timezone);
    if (scheduledAt === null) errors.local = 'Data e ora non valide';
  }
  let durationMinutes: number | null = null;
  if (draft.duration.trim()) {
    if (!/^\d{1,4}$/.test(draft.duration.trim())) errors.duration = 'Indica i minuti (es. 45)';
    else durationMinutes = Number(draft.duration.trim());
  }
  return {
    scheduledAt,
    durationMinutes,
    interviewers: draft.interviewers
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
    modality: nullable(draft.modality) as InterviewModality | null,
    location: nullable(draft.location),
    meetingUrl: nullable(draft.meetingUrl),
    preparationNotes: nullable(draft.preparationNotes),
  };
}

/**
 * Modulo di un round di colloquio (creazione o modifica). La data si inserisce nell'ora locale del
 * fuso scelto (predefinito: quello del workspace) e viaggia come istante UTC. Per un round
 * completato la data è bloccata (la si registra completandolo).
 */
export function InterviewForm({
  mode,
  interview,
  workspaceZone,
  followUpOf,
  suggestedTitle,
  onSave,
  onCancel,
}: {
  mode: 'create' | 'edit';
  interview: Interview | null;
  workspaceZone: string;
  followUpOf?: string;
  suggestedTitle: string;
  onSave: (payload: CreateInterviewInput | UpdateInterviewInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => initial(interview, workspaceZone));
  const [base] = useState<Draft>(draft);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const lockSchedule = mode === 'edit' && interview?.status === 'completed';
  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  useDirtyReporter(`interview-form:${interview?.id ?? 'new'}`, dirty);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: Errors = {};
    const t = typed(draft, found);
    let payload: CreateInterviewInput | UpdateInterviewInput;
    if (mode === 'create') {
      const candidate = {
        ...(draft.title.trim() ? { title: draft.title.trim() } : {}),
        type: draft.type,
        ...(t.scheduledAt !== null ? { scheduledAt: t.scheduledAt, timezone: draft.timezone } : {}),
        ...(t.durationMinutes !== null ? { durationMinutes: t.durationMinutes } : {}),
        ...(t.modality ? { modality: t.modality } : {}),
        ...(t.location ? { location: t.location } : {}),
        ...(t.meetingUrl ? { meetingUrl: t.meetingUrl } : {}),
        interviewers: t.interviewers,
        ...(t.preparationNotes ? { preparationNotes: t.preparationNotes } : {}),
        ...(followUpOf ? { followUpOf } : {}),
      };
      const parsed = createInterviewInput.safeParse(candidate);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const key = FIELD_OF_PATH[String(issue.path[0])];
          if (key) found[key] ??= issue.message;
        }
      } else payload = parsed.data;
      if (Object.keys(found).length > 0) return setErrors(found);
      payload = parsed.data as CreateInterviewInput;
    } else {
      const was = initial(interview, workspaceZone);
      const wasT = typed(was, {});
      const changes: Record<string, unknown> = {};
      if (draft.title.trim() !== was.title) changes['title'] = draft.title.trim();
      if (draft.type !== was.type) changes['type'] = draft.type;
      if (!lockSchedule) {
        if (t.scheduledAt !== wasT.scheduledAt) changes['scheduledAt'] = t.scheduledAt;
        if (draft.timezone !== was.timezone && t.scheduledAt !== null)
          changes['timezone'] = draft.timezone;
      }
      if (t.durationMinutes !== wasT.durationMinutes)
        changes['durationMinutes'] = t.durationMinutes;
      if (t.modality !== wasT.modality) changes['modality'] = t.modality;
      if (t.location !== wasT.location) changes['location'] = t.location;
      if (t.meetingUrl !== wasT.meetingUrl) changes['meetingUrl'] = t.meetingUrl;
      if (JSON.stringify(t.interviewers) !== JSON.stringify(wasT.interviewers))
        changes['interviewers'] = t.interviewers;
      if (t.preparationNotes !== wasT.preparationNotes)
        changes['preparationNotes'] = t.preparationNotes;
      if (Object.keys(changes).length === 0) return onCancel();
      const parsed = updateInterviewInput.safeParse(changes);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const key = FIELD_OF_PATH[String(issue.path[0])];
          if (key) found[key] ??= issue.message;
        }
      }
      if (Object.keys(found).length > 0 || !parsed.success) return setErrors(found);
      payload = parsed.data;
    }
    setPending(true);
    try {
      await onSave(payload);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 400 && error.issues?.length) {
        const mapped: Errors = {};
        for (const issue of error.issues) {
          const key = FIELD_OF_PATH[issue.path.split('.')[0] ?? ''];
          if (key) mapped[key] ??= issue.message;
        }
        setErrors(Object.keys(mapped).length ? mapped : { form: error.message });
      } else {
        setErrors({
          form:
            error instanceof ApiRequestError && error.status >= 400 && error.status < 500
              ? error.message
              : 'Non siamo riusciti a salvare. Riprova.',
        });
      }
    } finally {
      setPending(false);
    }
  };

  const id = `iv-${interview?.id ?? 'new'}`;
  const text = (
    key: keyof Draft,
    label: string,
    extra: { type?: string; max?: number; hint?: string; placeholder?: string } = {},
  ) => (
    <Field id={`${id}-${key}`} label={label} hint={extra.hint} error={errors[key]}>
      <Input
        id={`${id}-${key}`}
        type={extra.type ?? 'text'}
        value={draft[key]}
        maxLength={extra.max ?? LIMITS.nameMax}
        placeholder={extra.placeholder}
        autoComplete="off"
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={
          errors[key] ? `${id}-${key}-error` : extra.hint ? `${id}-${key}-hint` : undefined
        }
        onChange={(e) => set(key, e.target.value as never)}
      />
    </Field>
  );

  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      className="space-y-4 rounded-lg border border-border-strong bg-surface-muted/40 p-4"
    >
      <h4 className="text-sm font-semibold">
        {mode === 'create'
          ? followUpOf
            ? 'Nuova fase successiva'
            : 'Nuovo colloquio'
          : 'Modifica il colloquio'}
      </h4>
      <div className="grid gap-4 md:grid-cols-2">
        {text('title', 'Titolo', {
          placeholder: suggestedTitle,
          hint: 'Facoltativo: se vuoto sarà «' + suggestedTitle + '».',
        })}
        <Field id={`${id}-type`} label="Tipo di colloquio">
          <Select
            id={`${id}-type`}
            value={draft.type}
            onChange={(e) => set('type', e.target.value as InterviewType)}
          >
            {INTERVIEW_TYPES.map((t) => (
              <option key={t} value={t}>
                {INTERVIEW_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <fieldset className="space-y-3" disabled={lockSchedule}>
        <legend className="text-sm font-medium">Quando</legend>
        <div className="grid gap-4 md:grid-cols-3">
          {text('local', 'Data e ora', {
            type: 'datetime-local',
            hint: 'Lascia vuoto se non è ancora fissato.',
          })}
          <Field id={`${id}-timezone`} label="Fuso orario">
            <Select
              id={`${id}-timezone`}
              value={draft.timezone}
              onChange={(e) => set('timezone', e.target.value)}
            >
              {timeZoneOptions(workspaceZone).map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
          {text('duration', 'Durata (minuti)', { max: 4, placeholder: '45' })}
        </div>
        {lockSchedule ? (
          <p className="text-xs text-muted-foreground">
            La data di un colloquio completato non si cambia.
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <Field id={`${id}-modality`} label="Modalità">
          <Select
            id={`${id}-modality`}
            value={draft.modality}
            onChange={(e) => set('modality', e.target.value)}
          >
            <option value="">Non indicata</option>
            {INTERVIEW_MODALITIES.map((m) => (
              <option key={m} value={m}>
                {INTERVIEW_MODALITY_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        {text('location', 'Luogo', { placeholder: 'Sede, indirizzo…' })}
      </div>
      {text('meetingUrl', 'Collegamento alla riunione', {
        type: 'url',
        max: LIMITS.urlMax,
        placeholder: 'https://',
        hint: 'Solo indirizzi http o https.',
      })}

      <Field
        id={`${id}-interviewers`}
        label="Chi conduce il colloquio"
        hint="Un nome per riga (massimo 10)."
        error={errors.interviewers}
      >
        <Textarea
          id={`${id}-interviewers`}
          value={draft.interviewers}
          className="min-h-20"
          aria-invalid={errors.interviewers ? true : undefined}
          aria-describedby={
            errors.interviewers ? `${id}-interviewers-error` : `${id}-interviewers-hint`
          }
          onChange={(e) => set('interviewers', e.target.value)}
        />
      </Field>
      <Field
        id={`${id}-preparationNotes`}
        label="Note di preparazione"
        error={errors.preparationNotes}
      >
        <Textarea
          id={`${id}-preparationNotes`}
          value={draft.preparationNotes}
          maxLength={LIMITS.descriptionMax}
          className="min-h-24"
          onChange={(e) => set('preparationNotes', e.target.value)}
        />
      </Field>

      {errors.form ? (
        <p
          role="alert"
          className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
        >
          {errors.form}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Annulla
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Salvataggio…' : mode === 'create' ? 'Aggiungi colloquio' : 'Salva modifiche'}
        </Button>
      </div>
    </form>
  );
}
