import { PipelineStatusBadge } from '@/features/pipeline/status-badge';
import type { Label, Opportunity } from '@jobward/schemas';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { LabelChip } from '@/features/labels/label-chip';
import { cn } from '@/lib/cn';
import { formatCalendarDate, formatDateTime } from '@/lib/format';
import {
  CONTRACT_LABELS,
  OUTCOME_LABELS,
  PRIORITY_LABELS,
  PRIORITY_TONE,
  WORK_MODE_LABELS,
} from '@/lib/labels';
import { formatSalary } from '@/lib/salary';
import type { ColumnDef, TableState } from './table-state';

/** Valore mancante: il segno è decorativo, il testo per gli screen reader è esplicito. */
const Missing = () => (
  <>
    <span aria-hidden="true" className="text-muted-foreground">
      —
    </span>
    <span className="sr-only">Non indicato</span>
  </>
);

const orMissing = (value: ReactNode) => (value === null || value === '' ? <Missing /> : value);

export interface ResultContext {
  labelsById: Map<string, Label>;
  timeZone: string;
  /** Indirizzo del dettaglio di una scheda: conserva ricerca e filtri nell'indirizzo. */
  detailHref: (item: Opportunity) => string;
}

function renderCell(column: ColumnDef, item: Opportunity, ctx: ResultContext): ReactNode {
  switch (column.key) {
    case 'title':
      return (
        <Link
          to={ctx.detailHref(item)}
          className="rounded-sm font-medium break-words hover:underline"
        >
          {item.title}
        </Link>
      );
    case 'company':
      return orMissing(item.company);
    case 'board':
      return item.boardName;
    case 'column':
      return item.columnName;
    case 'priority':
      return item.priority === 'none' ? (
        <Missing />
      ) : (
        <Badge tone={PRIORITY_TONE[item.priority]}>{PRIORITY_LABELS[item.priority]}</Badge>
      );
    case 'location':
      return orMissing(item.location);
    case 'workMode':
      return orMissing(item.workMode ? WORK_MODE_LABELS[item.workMode] : null);
    case 'contractType':
      return orMissing(item.contractType ? CONTRACT_LABELS[item.contractType] : null);
    case 'salary':
      return orMissing(formatSalary(item));
    case 'stage':
      return <PipelineStatusBadge state={item} />;
    case 'outcome':
      return orMissing(item.outcome ? OUTCOME_LABELS[item.outcome] : null);
    case 'labels': {
      const labels = item.labelIds.flatMap((id) => ctx.labelsById.get(id) ?? []);
      return labels.length === 0 ? (
        <Missing />
      ) : (
        <ul className="flex flex-wrap gap-1">
          {labels.map((l) => (
            <li key={l.id}>
              <LabelChip name={l.name} color={l.color} />
            </li>
          ))}
        </ul>
      );
    }
    case 'appliedOn':
      return orMissing(formatCalendarDate(item.appliedOn));
    case 'updatedAt':
      return formatDateTime(item.updatedAt, ctx.timeZone);
    default:
      return null;
  }
}

/** Tabella (da `md`). Ordinamento e paginazione sono del server: qui solo presentazione e accessibilità. */
export function ResultsTable({
  items,
  columns,
  state,
  onSort,
  ctx,
  busy,
}: {
  items: Opportunity[];
  columns: ColumnDef[];
  state: TableState;
  onSort: (column: ColumnDef) => void;
  ctx: ResultContext;
  busy: boolean;
}) {
  return (
    <div
      // Lo scorrimento orizzontale resta confinato nel contenitore: la pagina non scorre di lato.
      className="hidden overflow-x-auto rounded-lg border border-border bg-surface md:block"
      // WCAG 2.1.1 (axe: scrollable-region-focusable): un'area che scorre deve essere raggiungibile
      // da tastiera per poterla scorrere con le frecce.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      role="region"
      aria-label="Tabella delle opportunità (scorre in orizzontale)"
    >
      <table
        aria-busy={busy}
        className={cn('w-full min-w-max border-collapse text-left text-sm', busy && 'opacity-70')}
      >
        <caption className="sr-only">
          Opportunità, ordinate per{' '}
          {columns.find((c) => c.sort === state.sort)?.label ?? 'ultima modifica'}{' '}
          {state.dir === 'asc' ? 'in ordine crescente' : 'in ordine decrescente'}
        </caption>
        <thead className="border-b border-border bg-surface-muted">
          <tr>
            {columns.map((column) => {
              const sorted = column.sort === state.sort;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    sorted ? (state.dir === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                  className="px-3 py-2 font-semibold whitespace-nowrap"
                >
                  {column.sort ? (
                    <button
                      type="button"
                      onClick={() => onSort(column)}
                      className="-mx-1 inline-flex min-h-8 items-center gap-1 rounded-sm px-1 hover:underline"
                    >
                      {column.label}
                      {sorted ? (
                        state.dir === 'asc' ? (
                          <ArrowUp aria-hidden="true" className="size-3.5" />
                        ) : (
                          <ArrowDown aria-hidden="true" className="size-3.5" />
                        )
                      ) : (
                        <ArrowUpDown
                          aria-hidden="true"
                          className="size-3.5 text-muted-foreground"
                        />
                      )}
                      <span className="sr-only">
                        {sorted
                          ? `, ordinata ${state.dir === 'asc' ? 'in ordine crescente' : 'in ordine decrescente'}. Attiva per invertire`
                          : ', attiva per ordinare'}
                      </span>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              data-card-id={item.id}
              className="border-b border-border transition-colors duration-100 last:border-b-0 hover:bg-hover-soft"
            >
              {columns.map((column) =>
                column.key === 'title' ? (
                  <th
                    key={column.key}
                    scope="row"
                    className="max-w-72 px-3 py-2.5 text-left align-top font-normal"
                  >
                    {renderCell(column, item, ctx)}
                    {item.archivedAt !== null ? <Badge className="ml-2">Archiviata</Badge> : null}
                  </th>
                ) : (
                  <td key={column.key} className="px-3 py-2.5 align-top">
                    {renderCell(column, item, ctx)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Elenco compatto (sotto `md`): le informazioni fondamentali subito visibili, niente tabella di 12 colonne in 390 px. */
export function ResultsList({
  items,
  ctx,
  busy,
  showBoard,
}: {
  items: Opportunity[];
  ctx: ResultContext;
  busy: boolean;
  showBoard: boolean;
}) {
  return (
    <ul
      aria-label="Opportunità"
      aria-busy={busy}
      className={cn('space-y-2 md:hidden', busy && 'opacity-70')}
    >
      {items.map((item) => {
        const labels = item.labelIds.flatMap((id) => ctx.labelsById.get(id) ?? []);
        const where = [item.company, item.location].filter(Boolean).join(' · ');
        return (
          <li
            key={item.id}
            data-card-id={item.id}
            className="rounded-lg border border-border bg-surface p-3"
          >
            <Link
              to={ctx.detailHref(item)}
              className="-my-1 flex min-h-11 items-center rounded-sm text-sm font-medium break-words hover:underline"
            >
              {item.title}
            </Link>
            {where ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{where}</p>
            ) : null}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {showBoard ? `${item.boardName} · ` : ''}
              {item.columnName}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {item.priority !== 'none' ? (
                <Badge tone={PRIORITY_TONE[item.priority]}>
                  Priorità {PRIORITY_LABELS[item.priority].toLowerCase()}
                </Badge>
              ) : null}
              <PipelineStatusBadge state={item} />
              {item.outcome ? <Badge>{OUTCOME_LABELS[item.outcome]}</Badge> : null}
              {item.appliedOn ? (
                <span className="text-xs text-muted-foreground">
                  Candidatura {formatCalendarDate(item.appliedOn)}
                </span>
              ) : null}
            </div>
            {labels.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1">
                {labels.map((l) => (
                  <li key={l.id}>
                    <LabelChip name={l.name} color={l.color} />
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
