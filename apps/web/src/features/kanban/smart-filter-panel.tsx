import type { Label } from '@jobward/schemas';
import {
  CONTRACT_TYPES,
  DATE_PRESETS,
  NONE,
  PRIORITIES,
  resolveDateFilter,
  shiftDateFilter,
  STAGES,
  WORK_MODES,
  isValidDateFilter,
  type DateFilter,
  type DatePreset,
  type SmartFilterConfig,
  type SmartFilterContext,
} from '@jobward/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { LabelChip } from '@/features/labels/label-chip';
import { CheckGroup } from '@/features/opportunities/filters-panel';
import { CONTRACT_LABELS, PRIORITY_LABELS, STAGE_LABELS, WORK_MODE_LABELS } from '@/lib/labels';
import {
  countText,
  DATE_FIELD_LABELS,
  DATE_PRESET_LABELS,
  formatRange,
  type DateKey,
} from './smart-filter-labels';

const withNone = (values: readonly string[], labels: Record<string, string>, none: string) => [
  ...values.map((value) => ({ value, label: labels[value] ?? value })),
  { value: NONE, label: none },
];

const DATE_KEYS: DateKey[] = ['created', 'applied', 'updated'];

/** Copia della configurazione con un campo impostato (o rimosso se `undefined`). */
function withField(
  config: SmartFilterConfig,
  key: Exclude<keyof SmartFilterConfig, 'v'>,
  value: unknown,
): SmartFilterConfig {
  const next: Record<string, unknown> = { ...config };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next as unknown as SmartFilterConfig;
}

/** Passo indietro/avanti nel tempo: ‹ periodo › con l'intervallo di giorni coperto. */
export function DateStepper({
  label,
  filter,
  today,
  onChange,
}: {
  label: string;
  filter: DateFilter;
  today: string;
  onChange: (next: DateFilter) => void;
}) {
  const previous = shiftDateFilter(filter, -1);
  const next = shiftDateFilter(filter, 1);
  const range = formatRange(resolveDateFilter(filter, today));
  return (
    <div className="flex items-center gap-1" role="group" aria-label={`Navigazione: ${label}`}>
      <Button
        variant="secondary"
        size="icon"
        aria-label={`Periodo precedente (${label})`}
        disabled={previous === null}
        onClick={() => previous && onChange(previous)}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <p className="min-w-0 flex-1 px-1 text-center text-sm font-medium" aria-live="polite">
        {range || 'Intervallo aperto'}
      </p>
      <Button
        variant="secondary"
        size="icon"
        aria-label={`Periodo successivo (${label})`}
        disabled={next === null}
        onClick={() => next && onChange(next)}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Un filtro data: preset, navigazione nel tempo e, per «personalizzato», i due estremi. */
function DateFilterField({
  id,
  fieldKey,
  value,
  today,
  onChange,
}: {
  id: string;
  fieldKey: DateKey;
  value: DateFilter | undefined;
  today: string;
  onChange: (next: DateFilter | undefined) => void;
}) {
  const label = DATE_FIELD_LABELS[fieldKey];
  const committed = value?.preset === 'custom' ? value : null;
  // Bozza degli estremi: l'utente può digitare una data alla volta senza che un intervallo
  // temporaneamente incoerente venga applicato o cancellato.
  const [draft, setDraft] = useState({ from: committed?.from ?? '', to: committed?.to ?? '' });
  const committedKey = committed ? `${committed.from ?? ''}|${committed.to ?? ''}` : '';
  const [syncedKey, setSyncedKey] = useState(committedKey);
  if (committedKey !== syncedKey) {
    // Cambiato dall'esterno (frecce di navigazione, contrassegno, «Ripristina»): la bozza lo segue.
    setSyncedKey(committedKey);
    setDraft({ from: committed?.from ?? '', to: committed?.to ?? '' });
  }
  const candidate: DateFilter = {
    preset: 'custom',
    from: draft.from || null,
    to: draft.to || null,
  };
  const draftInvalid = value?.preset === 'custom' && !isValidDateFilter(candidate);

  const selectPreset = (preset: DatePreset | '') => {
    if (preset === '') return onChange(undefined);
    if (preset === 'custom') {
      const range = value ? resolveDateFilter(value, today) : { from: today, to: today };
      return onChange({ preset: 'custom', from: range.from ?? today, to: range.to ?? today });
    }
    onChange({ preset, offset: 0 });
  };

  const setBound = (bound: 'from' | 'to', text: string) => {
    const nextDraft = { ...draft, [bound]: text };
    setDraft(nextDraft);
    const next: DateFilter = {
      preset: 'custom',
      from: nextDraft.from || null,
      to: nextDraft.to || null,
    };
    if (isValidDateFilter(next)) {
      setSyncedKey(`${next.from ?? ''}|${next.to ?? ''}`);
      onChange(next);
    }
  };

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <Select
        id={id}
        aria-label={`Periodo: ${label}`}
        value={value?.preset ?? ''}
        onChange={(e) => selectPreset(e.target.value as DatePreset | '')}
      >
        <option value="">Qualsiasi data</option>
        {DATE_PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            {DATE_PRESET_LABELS[preset]}
          </option>
        ))}
      </Select>
      {value?.preset === 'custom' ? (
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${id}-from`} label="Dal">
            <Input
              id={`${id}-from`}
              type="date"
              value={draft.from}
              aria-invalid={draftInvalid || undefined}
              onChange={(e) => setBound('from', e.target.value)}
            />
          </Field>
          <Field id={`${id}-to`} label="Al">
            <Input
              id={`${id}-to`}
              type="date"
              value={draft.to}
              aria-invalid={draftInvalid || undefined}
              onChange={(e) => setBound('to', e.target.value)}
            />
          </Field>
        </div>
      ) : null}
      {draftInvalid ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {draft.from && draft.to && draft.from > draft.to
            ? 'La data finale precede quella iniziale: il filtro non è stato modificato.'
            : 'Indica almeno una data.'}
        </p>
      ) : null}
      {value && !draftInvalid ? (
        <DateStepper label={label} filter={value} today={today} onChange={onChange} />
      ) : null}
    </fieldset>
  );
}

/**
 * Pannello dei filtri del Kanban: a schermo intero su telefono, pannello laterale da `md`. I filtri
 * si applicano subito (la bacheca resta visibile dietro il velo leggero su schermi larghi).
 */
export function SmartFilterPanel({
  open,
  onOpenChange,
  config,
  onChange,
  onClear,
  context,
  companies,
  labels,
  visible,
  total,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: SmartFilterConfig;
  onChange: (next: SmartFilterConfig, options?: { replace?: boolean }) => void;
  onClear: () => void;
  context: SmartFilterContext;
  companies: string[];
  labels: Label[];
  visible: number;
  total: number;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const id = useId();
  const active = Object.keys(config).length > 1;

  // Località: digitazione fluida (bozza locale), indirizzo aggiornato dopo una breve pausa.
  const [locationInput, setLocationInput] = useState(config.location ?? '');
  const [syncedLocation, setSyncedLocation] = useState(config.location ?? '');
  if ((config.location ?? '') !== syncedLocation) {
    setSyncedLocation(config.location ?? '');
    setLocationInput(config.location ?? '');
  }
  useEffect(() => {
    if (locationInput.trim() === (config.location ?? '')) return;
    const timer = window.setTimeout(() => {
      onChange(withField(config, 'location', locationInput.trim() || undefined), {
        replace: true,
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [locationInput, config, onChange]);

  const dateField = (key: DateKey) => (
    <DateFilterField
      key={key}
      id={`${id}-${key}`}
      fieldKey={key}
      value={config[key]}
      today={context.today}
      onChange={(next) => onChange(withField(config, key, next))}
    />
  );

  const setList =
    (key: 'stage' | 'priority' | 'workMode' | 'contractType' | 'labelIds' | 'company') =>
    (values: string[]) =>
      onChange(withField(config, key, values.length > 0 ? values : undefined));

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Filtri"
      description="Restringono la vista delle schede: non modificano i dati."
      variant="drawer"
      {...(onCloseAutoFocus ? { onCloseAutoFocus } : {})}
    >
      <DialogBody className="space-y-6">
        <div className="space-y-5">{DATE_KEYS.map(dateField)}</div>

        <CheckGroup
          legend="Fase"
          options={withNone(STAGES, STAGE_LABELS, 'Non indicata')}
          selected={config.stage ?? []}
          onChange={setList('stage')}
        />
        <CheckGroup
          legend="Priorità"
          options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
          selected={config.priority ?? []}
          onChange={setList('priority')}
        />
        <CheckGroup
          legend="Modalità di lavoro"
          options={withNone(WORK_MODES, WORK_MODE_LABELS, 'Non indicata')}
          selected={config.workMode ?? []}
          onChange={setList('workMode')}
        />
        <CheckGroup
          legend="Tipo di contratto"
          options={withNone(CONTRACT_TYPES, CONTRACT_LABELS, 'Non indicato')}
          selected={config.contractType ?? []}
          onChange={setList('contractType')}
        />
        {companies.length > 0 ? (
          <div className="max-h-64 overflow-y-auto pr-1">
            <CheckGroup
              legend="Azienda"
              options={companies.map((name) => ({ value: name, label: name }))}
              selected={config.company ?? []}
              onChange={setList('company')}
            />
          </div>
        ) : null}
        {labels.length > 0 ? (
          <CheckGroup
            legend="Etichette (anche una sola)"
            options={labels.map((l) => ({
              value: l.id,
              label: <LabelChip name={l.name} color={l.color} />,
            }))}
            selected={config.labelIds ?? []}
            onChange={setList('labelIds')}
          />
        ) : null}

        <Field
          id={`${id}-location`}
          label="Località"
          hint="Contiene il testo indicato; ignora maiuscole e accenti."
        >
          <Input
            id={`${id}-location`}
            type="search"
            autoComplete="off"
            maxLength={120}
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
          />
        </Field>

        <p className="text-xs text-muted-foreground">
          Le schede senza il dato richiesto non compaiono, salvo scegliere «Non indicata».
        </p>
      </DialogBody>
      <DialogFooter>
        <p role="status" className="mr-auto text-sm text-muted-foreground">
          {countText(visible, total, active)}
        </p>
        <Button variant="secondary" disabled={!active} onClick={onClear}>
          Ripristina filtri
        </Button>
        <Button onClick={() => onOpenChange(false)}>Fatto</Button>
      </DialogFooter>
    </Dialog>
  );
}
