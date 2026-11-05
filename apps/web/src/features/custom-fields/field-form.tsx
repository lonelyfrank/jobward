import type { CustomField } from '@meet-roulette/schemas';
import { CUSTOM_FIELD_TYPES, LIMITS, type CustomFieldType } from '@meet-roulette/shared';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { userMessage } from '@/features/kanban/mutations';
import { ApiRequestError } from '@/lib/api';
import { useCreateField, useUpdateField } from './api';
import { ValueEditor } from './value-editor';
import { FIELD_TYPE_LABELS, type FieldDraft } from './values';

interface OptionDraft {
  /** Assente per un'opzione nuova: l'ID lo assegna il server. Le esistenti lo conservano. */
  id?: string;
  key: string;
  label: string;
}

interface FormState {
  name: string;
  type: CustomFieldType;
  maxLength: string;
  min: string;
  max: string;
  integerOnly: boolean;
  options: OptionDraft[];
}

let optionKey = 0;
const newOption = (label = '', id?: string): OptionDraft => ({
  ...(id ? { id } : {}),
  key: `o${optionKey++}`,
  label,
});

function initial(field: CustomField | null): FormState {
  const base: FormState = {
    name: field?.name ?? '',
    type: field?.type ?? 'text',
    maxLength: '',
    min: '',
    max: '',
    integerOnly: false,
    options: [],
  };
  if (!field) return { ...base, options: [newOption(), newOption()] };
  if (field.type === 'text' || field.type === 'long_text') {
    return { ...base, maxLength: field.config.maxLength ? String(field.config.maxLength) : '' };
  }
  if (field.type === 'number') {
    return {
      ...base,
      min: field.config.min === undefined ? '' : String(field.config.min),
      max: field.config.max === undefined ? '' : String(field.config.max),
      integerOnly: field.config.integerOnly,
    };
  }
  if (field.type === 'single_select' || field.type === 'multi_select') {
    return { ...base, options: field.config.options.map((o) => newOption(o.label, o.id)) };
  }
  return base;
}

const num = (text: string): number | undefined | 'invalid' => {
  const t = text.trim();
  if (t === '') return undefined;
  return /^-?\d+([.,]\d+)?$/.test(t) ? Number(t.replace(',', '.')) : 'invalid';
};

/** Costruisce la `config` del tipo scelto dallo stato del modulo; segnala i valori non numerici. */
function buildConfig(state: FormState): {
  config: Record<string, unknown>;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  switch (state.type) {
    case 'text':
    case 'long_text': {
      const max = num(state.maxLength);
      if (max === 'invalid' || (max !== undefined && (!Number.isInteger(max) || max < 1))) {
        errors['maxLength'] = 'Inserisci un numero intero positivo';
        return { config: {}, errors };
      }
      return { config: max === undefined ? {} : { maxLength: max }, errors };
    }
    case 'number': {
      const min = num(state.min);
      const max = num(state.max);
      if (min === 'invalid') errors['min'] = 'Inserisci un numero';
      if (max === 'invalid') errors['max'] = 'Inserisci un numero';
      if (typeof min === 'number' && typeof max === 'number' && min > max) {
        errors['max'] = 'Il massimo non può essere inferiore al minimo';
      }
      return {
        config: {
          ...(typeof min === 'number' ? { min } : {}),
          ...(typeof max === 'number' ? { max } : {}),
          integerOnly: state.integerOnly,
        },
        errors,
      };
    }
    case 'single_select':
    case 'multi_select': {
      const labels = state.options.map((o) => o.label.trim());
      if (labels.some((l) => l === '')) errors['options'] = 'Ogni opzione deve avere un nome';
      else if (new Set(labels.map((l) => l.toLowerCase())).size !== labels.length) {
        errors['options'] = 'Due opzioni hanno lo stesso nome';
      } else if (labels.length < 1) errors['options'] = 'Aggiungi almeno un’opzione';
      return {
        config: {
          options: state.options.map((o, i) => ({
            ...(o.id ? { id: o.id } : {}),
            label: labels[i] ?? '',
            color: null,
          })),
        },
        errors,
      };
    }
    default:
      return { config: {}, errors };
  }
}

/** Definizione per l'anteprima: le opzioni non ancora salvate ricevono un ID provvisorio locale. */
function previewField(state: FormState, config: Record<string, unknown>): CustomField {
  const options = state.options.map((o) => ({
    id: o.id ?? o.key,
    label: o.label.trim() || '…',
    color: null,
  }));
  const meta = {
    id: 'preview',
    boardId: '',
    position: 0,
    valueCount: 0,
    createdAt: 0,
    updatedAt: 0,
    isActive: true,
  };
  const name = state.name.trim() || 'Campo senza nome';
  switch (state.type) {
    case 'single_select':
    case 'multi_select':
      return { ...meta, name, type: state.type, config: { options } };
    case 'number':
      return {
        ...meta,
        name,
        type: 'number',
        config: {
          integerOnly: state.integerOnly,
          ...(config['min'] !== undefined ? { min: config['min'] as number } : {}),
          ...(config['max'] !== undefined ? { max: config['max'] as number } : {}),
        },
      };
    case 'text':
    case 'long_text':
      return { ...meta, name, type: state.type, config: {} };
    default:
      return { ...meta, name, type: state.type, config: {} };
  }
}

/** Creazione/modifica di un campo, con anteprima del controllo. Il tipo è fisso dopo la creazione. */
export function FieldForm({
  boardId,
  field,
  usedCount,
  onDone,
  onCancel,
}: {
  boardId: string;
  field: CustomField | null;
  usedCount: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const notify = useNotify();
  const create = useCreateField(boardId);
  const update = useUpdateField(boardId);
  const [state, setState] = useState<FormState>(() => initial(field));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [demo, setDemo] = useState<FieldDraft>(state.type === 'multi_select' ? [] : '');
  const editing = field !== null;
  const pending = create.isPending || update.isPending;

  const patch = (changes: Partial<FormState>) => {
    setState((s) => ({ ...s, ...changes }));
    setErrors({});
    setFormError(null);
  };
  const moveOption = (index: number, delta: number) => {
    const next = [...state.options];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    patch({ options: next });
  };

  const { config, errors: configErrors } = buildConfig(state);
  const hasOptions = state.type === 'single_select' || state.type === 'multi_select';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = { ...configErrors };
    if (!state.name.trim()) found['name'] = 'Scrivi il nome del campo';
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    const onError = (e: unknown) => {
      if (e instanceof ApiRequestError && e.status === 400 && e.issues?.length) {
        const mapped: Record<string, string> = {};
        for (const issue of e.issues) {
          const key = issue.path.startsWith('config.options')
            ? 'options'
            : issue.path.split('.')[0]!;
          mapped[key] ??= issue.message;
        }
        setErrors(mapped);
      } else setFormError(userMessage(e, 'Non siamo riusciti a salvare il campo. Riprova.'));
    };
    if (editing) {
      update.mutate(
        { fieldId: field.id, input: { name: state.name.trim(), config } },
        {
          onSuccess: () => {
            notify('success', 'Campo aggiornato.');
            onDone();
          },
          onError,
        },
      );
    } else {
      create.mutate(
        { name: state.name.trim(), type: state.type, config } as Parameters<
          typeof create.mutate
        >[0],
        {
          onSuccess: () => {
            notify('success', 'Campo creato.');
            onDone();
          },
          onError,
        },
      );
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field id="cf-name" label="Nome del campo" error={errors['name']}>
        <Input
          id="cf-name"
          value={state.name}
          maxLength={LIMITS.nameMax}
          autoComplete="off"
          placeholder="Es. Iscrizione all’albo, Turni disponibili, Stack richiesto"
          aria-invalid={errors['name'] ? true : undefined}
          aria-describedby={errors['name'] ? 'cf-name-error' : undefined}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </Field>

      <Field
        id="cf-type"
        label="Tipo di informazione"
        hint={
          editing
            ? 'Il tipo non si può cambiare dopo la creazione: eviterebbe di perdere i dati già inseriti.'
            : undefined
        }
      >
        <Select
          id="cf-type"
          value={state.type}
          disabled={editing}
          aria-describedby={editing ? 'cf-type-hint' : undefined}
          onChange={(e) => {
            const type = e.target.value as CustomFieldType;
            patch({ type });
            setDemo(type === 'multi_select' ? [] : '');
          }}
        >
          {CUSTOM_FIELD_TYPES.map((type) => (
            <option key={type} value={type}>
              {FIELD_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      </Field>

      {state.type === 'text' || state.type === 'long_text' ? (
        <Field
          id="cf-maxlength"
          label="Lunghezza massima (facoltativa)"
          hint="Numero di caratteri."
          error={errors['maxLength']}
        >
          <Input
            id="cf-maxlength"
            inputMode="numeric"
            value={state.maxLength}
            onChange={(e) => patch({ maxLength: e.target.value })}
          />
        </Field>
      ) : null}

      {state.type === 'number' ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Limiti (facoltativi)</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="cf-min" label="Minimo" error={errors['min']}>
              <Input
                id="cf-min"
                inputMode="decimal"
                value={state.min}
                onChange={(e) => patch({ min: e.target.value })}
              />
            </Field>
            <Field id="cf-max" label="Massimo" error={errors['max']}>
              <Input
                id="cf-max"
                inputMode="decimal"
                value={state.max}
                onChange={(e) => patch({ max: e.target.value })}
              />
            </Field>
          </div>
          <label className="flex min-h-9 items-center gap-2.5 text-sm max-md:min-h-11">
            <input
              type="checkbox"
              className="size-4"
              checked={state.integerOnly}
              onChange={(e) => patch({ integerOnly: e.target.checked })}
            />
            Solo numeri interi
          </label>
        </fieldset>
      ) : null}

      {hasOptions ? (
        <fieldset
          className="space-y-2"
          aria-describedby={errors['options'] ? 'cf-options-error' : undefined}
        >
          <legend className="text-sm font-medium">Opzioni</legend>
          <ol className="space-y-2">
            {state.options.map((option, index) => (
              <li key={option.key} className="flex items-center gap-1.5">
                <Input
                  aria-label={`Opzione ${index + 1}`}
                  value={option.label}
                  maxLength={LIMITS.nameMax}
                  autoComplete="off"
                  onChange={(e) =>
                    patch({
                      options: state.options.map((o) =>
                        o.key === option.key ? { ...o, label: e.target.value } : o,
                      ),
                    })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Sposta su l’opzione ${index + 1}`}
                  disabled={index === 0}
                  onClick={() => moveOption(index, -1)}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Sposta giù l’opzione ${index + 1}`}
                  disabled={index === state.options.length - 1}
                  onClick={() => moveOption(index, 1)}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Rimuovi l’opzione ${index + 1}`}
                  disabled={state.options.length <= 1}
                  onClick={() =>
                    patch({ options: state.options.filter((o) => o.key !== option.key) })
                  }
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ol>
          <Button
            variant="secondary"
            size="sm"
            disabled={state.options.length >= LIMITS.customFieldOptionsMax}
            onClick={() => patch({ options: [...state.options, newOption()] })}
          >
            <Plus aria-hidden="true" />
            Aggiungi opzione
          </Button>
          {editing && usedCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              Rinominare un’opzione non cambia i valori già salvati. Un’opzione ancora usata da una
              scheda non si può rimuovere.
            </p>
          ) : null}
          {errors['options'] ? (
            <p id="cf-options-error" role="alert" className="text-xs font-medium text-danger">
              {errors['options']}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <section
        aria-labelledby="cf-preview-title"
        className="rounded-md border border-dashed border-border-strong p-3"
      >
        <h4
          id="cf-preview-title"
          className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Anteprima
        </h4>
        <ValueEditor
          field={previewField(state, config)}
          draft={demo}
          onChange={setDemo}
          idPrefix="preview"
        />
      </section>

      {formError ? (
        <p
          role="alert"
          className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
        >
          {formError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Annulla
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Salvataggio…' : editing ? 'Salva campo' : 'Crea campo'}
        </Button>
      </div>
    </form>
  );
}
