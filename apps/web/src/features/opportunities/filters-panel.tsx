import type { BoardListItem, Column, Label } from '@jobward/schemas';
import {
  CONTRACT_TYPES,
  OUTCOMES,
  PRIORITIES,
  SALARY_PERIODS,
  STAGES,
  WORK_MODES,
} from '@jobward/shared';
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
import { SidebarSection, sidebarCheckClass } from './sidebar-section';

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
    <SidebarSection
      title={legend}
      count={selected.length}
      defaultOpen={legend === 'Priorità' || legend === 'Fase'}
    >
      <fieldset className="min-w-0 space-y-1">
        <legend className="sr-only">{legend}</legend>
        <ul className="space-y-0.5">
          {options.map((option) => (
            <li key={option.value}>
              <label className={sidebarCheckClass}>
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-primary"
                  checked={selected.includes(option.value)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...selected, option.value]
                        : selected.filter((v) => v !== option.value),
                    )
                  }
                />
                <span className="min-w-0 break-words">{option.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    </SidebarSection>
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
  boards,
  salaryHint,
  dateHint,
}: {
  state: TableState;
  onChange: (patch: Partial<TableState>) => void;
  labels: Label[];
  boards?: BoardListItem[];
  /** Colonne della bacheca selezionata (il filtro per colonna esiste solo con una bacheca). */
  columns: Column[] | undefined;
  salaryHint: string | null;
  dateHint: string | null;
}) {
  const setList = (key: ListKey) => (values: string[]) =>
    onChange({ lists: { ...state.lists, [key]: values } });

  return (
    <div className="min-w-0">
      {boards ? (
        <SidebarSection
          title="Bacheca e colonna"
          count={Number(Boolean(state.board)) + Number(Boolean(state.column))}
        >
          <div className="space-y-3">
            <Field id="filter-board" label="Bacheca">
              <Select
                id="filter-board"
                value={state.board}
                onChange={(e) => onChange({ board: e.target.value, column: '' })}
              >
                <option value="">Tutte le bacheche</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="filter-column" label="Colonna">
              <Select
                id="filter-column"
                value={state.column}
                disabled={!state.board || !columns}
                onChange={(e) => onChange({ column: e.target.value })}
              >
                <option value="">
                  {state.board ? 'Tutte le colonne' : 'Scegli prima una bacheca'}
                </option>
                {columns?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </SidebarSection>
      ) : null}
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

      {!boards && columns ? (
        <SidebarSection title="Colonna della bacheca" count={Number(Boolean(state.column))}>
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
        </SidebarSection>
      ) : null}

      <SidebarSection title="Data di candidatura" count={Number(Boolean(state.from || state.to))}>
        <fieldset className="min-w-0 space-y-2">
          <legend className="sr-only">Data di candidatura</legend>
          <div className="grid min-w-0 gap-3">
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
      </SidebarSection>

      <SidebarSection
        title="Retribuzione"
        count={Number(Boolean(state.salaryMin || state.salaryMax))}
      >
        <fieldset className="min-w-0 space-y-2">
          <legend className="sr-only">Retribuzione</legend>
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
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
      </SidebarSection>

      <SidebarSection title="Archivio" count={Number(state.archived !== 'exclude')}>
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
      </SidebarSection>
    </div>
  );
}
