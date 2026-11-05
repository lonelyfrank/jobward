import type { Column, Label } from '@meet-roulette/schemas';
import {
  CONTRACT_TYPES,
  OUTCOMES,
  PRIORITIES,
  SALARY_PERIODS,
  STAGES,
  WORK_MODES,
} from '@meet-roulette/shared';
import type { ReactNode } from 'react';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { LabelChip } from '@/features/labels/label-chip';
import {
  CONTRACT_LABELS,
  OUTCOME_LABELS,
  PERIOD_LABELS,
  PRIORITY_LABELS,
  STAGE_LABELS,
  WORK_MODE_LABELS,
} from '@/lib/labels';
import type { TableState } from './table-state';

type ListKey = keyof TableState['lists'];

function CheckGroup({
  legend,
  options,
  selected,
  onChange,
}: {
  legend: string;
  options: { value: string; label: ReactNode }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className="min-w-0 space-y-1">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <ul className="space-y-0.5">
        {options.map((option) => (
          <li key={option.value}>
            <label className="flex min-h-8 cursor-pointer items-center gap-2.5 rounded-md px-1 text-sm hover:bg-surface-muted max-md:min-h-11">
              <input
                type="checkbox"
                className="size-4 shrink-0"
                checked={selected.includes(option.value)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, option.value]
                      : selected.filter((v) => v !== option.value),
                  )
                }
              />
              <span className="min-w-0">{option.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

const withNone = (values: readonly string[], labels: Record<string, string>, none: string) => [
  ...values.map((value) => ({ value, label: labels[value] ?? value })),
  { value: 'none', label: none },
];

/**
 * Filtri della tabella. Semantica: i valori dello STESSO gruppo si sommano (OR), i gruppi si
 * combinano tra loro (AND). Ogni controllo ha un'etichetta testuale; nessuna informazione è
 * affidata al colore.
 */
export function FiltersPanel({
  state,
  onChange,
  labels,
  columns,
  salaryHint,
  dateHint,
}: {
  state: TableState;
  onChange: (patch: Partial<TableState>) => void;
  labels: Label[];
  /** Colonne della bacheca selezionata (il filtro per colonna esiste solo con una bacheca). */
  columns: Column[] | undefined;
  salaryHint: string | null;
  dateHint: string | null;
}) {
  const setList = (key: ListKey) => (values: string[]) =>
    onChange({ lists: { ...state.lists, [key]: values } });

  return (
    <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 lg:grid-cols-3">
      <CheckGroup
        legend="Priorità"
        options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
        selected={state.lists.priority}
        onChange={setList('priority')}
      />
      <CheckGroup
        legend="Fase"
        options={withNone(STAGES, STAGE_LABELS, 'Non indicata')}
        selected={state.lists.stage}
        onChange={setList('stage')}
      />
      <CheckGroup
        legend="Esito"
        options={withNone(OUTCOMES, OUTCOME_LABELS, 'Non indicato')}
        selected={state.lists.outcome}
        onChange={setList('outcome')}
      />
      <CheckGroup
        legend="Modalità di lavoro"
        options={withNone(WORK_MODES, WORK_MODE_LABELS, 'Non indicata')}
        selected={state.lists.mode}
        onChange={setList('mode')}
      />
      <CheckGroup
        legend="Tipo di contratto"
        options={withNone(CONTRACT_TYPES, CONTRACT_LABELS, 'Non indicato')}
        selected={state.lists.contract}
        onChange={setList('contract')}
      />
      {labels.length > 0 ? (
        <CheckGroup
          legend="Etichette (anche una sola)"
          options={labels.map((l) => ({
            value: l.id,
            label: <LabelChip name={l.name} color={l.color} />,
          }))}
          selected={state.lists.label}
          onChange={setList('label')}
        />
      ) : null}

      {columns ? (
        <Field id="filter-column" label="Colonna">
          <Select
            id="filter-column"
            value={state.column}
            onChange={(e) => onChange({ column: e.target.value })}
          >
            <option value="">Tutte le colonne</option>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <fieldset className="min-w-0 space-y-2">
        <legend className="mb-1 text-sm font-medium">Data di candidatura</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field id="filter-from" label="Dal">
            <Input
              id="filter-from"
              type="date"
              value={state.from}
              onChange={(e) => onChange({ from: e.target.value })}
            />
          </Field>
          <Field id="filter-to" label="Al">
            <Input
              id="filter-to"
              type="date"
              value={state.to}
              onChange={(e) => onChange({ to: e.target.value })}
            />
          </Field>
        </div>
        {dateHint ? (
          <p role="alert" className="text-xs font-medium text-danger">
            {dateHint}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="min-w-0 space-y-2">
        <legend className="mb-1 text-sm font-medium">Retribuzione</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field id="filter-smin" label="Da">
            <Input
              id="filter-smin"
              inputMode="numeric"
              value={state.salaryMin}
              onChange={(e) => onChange({ salaryMin: e.target.value.replace(/\D/g, '') })}
            />
          </Field>
          <Field id="filter-smax" label="A">
            <Input
              id="filter-smax"
              inputMode="numeric"
              value={state.salaryMax}
              onChange={(e) => onChange({ salaryMax: e.target.value.replace(/\D/g, '') })}
            />
          </Field>
          <Field id="filter-cur" label="Valuta">
            <Input
              id="filter-cur"
              maxLength={3}
              placeholder="EUR"
              value={state.currency}
              onChange={(e) => onChange({ currency: e.target.value.toUpperCase() })}
            />
          </Field>
          <Field id="filter-per" label="Periodicità">
            <Select
              id="filter-per"
              value={state.period}
              onChange={(e) => onChange({ period: e.target.value })}
            >
              <option value="">—</option>
              {SALARY_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          Si confrontano solo importi nella stessa valuta e periodicità, senza conversioni.
        </p>
        {salaryHint ? (
          <p role="alert" className="text-xs font-medium text-danger">
            {salaryHint}
          </p>
        ) : null}
      </fieldset>

      <Field id="filter-archived" label="Schede archiviate">
        <Select
          id="filter-archived"
          value={state.archived}
          onChange={(e) => onChange({ archived: e.target.value as TableState['archived'] })}
        >
          <option value="exclude">Nascoste</option>
          <option value="include">Incluse</option>
          <option value="only">Solo archiviate</option>
        </Select>
      </Field>
    </div>
  );
}
