import { LIMITS } from '@jobward/shared';
import { Columns3, Filter, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';
import { useBoardDetail, useBoards } from '@/features/boards/api';
import { useLabels } from '@/features/labels/api';
import { useWorkspace } from '@/features/workspace/context';
import {
  CONTRACT_LABELS,
  OUTCOME_LABELS,
  PERIOD_LABELS,
  PRIORITY_LABELS,
  STAGE_LABELS,
  WORK_MODE_LABELS,
} from '@/lib/labels';
import { readStorage, writeStorage } from '@/lib/storage';
import { useOpportunities } from './api';
import { FiltersPanel } from './filters-panel';
import { ResultsList, ResultsTable, type ResultContext } from './results';
import {
  activeFilterCount,
  clearFilters,
  COLUMNS_STORAGE_KEY,
  parseHiddenColumns,
  readTableState,
  TABLE_COLUMNS,
  toApiQuery,
  writeTableState,
  type ColumnDef,
  type TableState,
} from './table-state';

const VALUE_LABELS: Record<string, Record<string, string>> = {
  priority: PRIORITY_LABELS,
  stage: STAGE_LABELS,
  outcome: OUTCOME_LABELS,
  mode: WORK_MODE_LABELS,
  contract: CONTRACT_LABELS,
};
const GROUP_TITLES = {
  priority: 'Priorità',
  stage: 'Fase',
  outcome: 'Esito',
  mode: 'Modalità',
  contract: 'Contratto',
  label: 'Etichette',
} as const;

const DEBOUNCE_MS = 300;

/**
 * Elenco delle opportunità con ricerca, filtri, ordinamento e paginazione sul server. Usato dalla
 * schermata Opportunità (tutte le bacheche) e dalla vista Tabella di una bacheca (`fixedBoardId`):
 * stessa rotta, stessi dati del Kanban. Lo stato vive nell'indirizzo.
 */
export function OpportunitiesView({ fixedBoardId }: { fixedBoardId?: string }) {
  const { workspace } = useWorkspace();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const urlKey = params.toString();
  const urlState = useMemo(() => readTableState(params), [params]);
  // Stato ottimistico: l'indirizzo si aggiorna in modo asincrono, la spunta deve cambiare subito.
  // Vale finché l'indirizzo non cambia (qualunque ne sia la causa: poi torna la fonte di verità).
  const [pending, setPending] = useState<{ state: TableState; base: string } | null>(null);
  if (pending && urlKey !== pending.base) setPending(null);
  const baseState: TableState = pending?.state ?? urlState;
  const state: TableState = fixedBoardId ? { ...baseState, board: fixedBoardId } : baseState;

  const boards = useBoards();
  const labels = useLabels();
  const board = useBoardDetail(state.board, state.board !== '');

  const update = (patch: Partial<TableState>, options: { keepPage?: boolean } = {}) => {
    const next: TableState = {
      ...state,
      ...patch,
      page: options.keepPage ? (patch.page ?? state.page) : 1,
    };
    const nextParams = writeTableState({ ...next, board: fixedBoardId ? '' : next.board });
    if (nextParams.toString() === urlKey) return;
    setPending({ state: next, base: urlKey });
    // Filtri, ordine e pagina sono passi di navigazione ("indietro" li annulla uno per volta);
    // la digitazione nella ricerca invece sostituisce la voce, per non riempire la cronologia.
    setParams(nextParams);
  };

  // --- ricerca con attesa: nessuna richiesta a ogni carattere ---------------------------------
  const [input, setInput] = useState(state.q);
  const [syncedQ, setSyncedQ] = useState(state.q);
  if (state.q !== syncedQ) {
    // L'indirizzo è cambiato dall'esterno ("indietro", "Cancella filtri"): la casella lo segue.
    setSyncedQ(state.q);
    setInput(state.q);
  }
  useEffect(() => {
    if (input === state.q) return;
    const timer = window.setTimeout(() => {
      const next: TableState = { ...state, q: input, page: 1 };
      setParams(writeTableState({ ...next, board: fixedBoardId ? '' : next.board }), {
        replace: true,
      });
      setSyncedQ(input);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // `state` cambia a ogni render: la dipendenza utile è il testo digitato e quello nell'indirizzo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, state.q]);

  // --- colonne visibili: preferenza locale al dispositivo -------------------------------------
  const [hidden, setHidden] = useState(() => parseHiddenColumns(readStorage(COLUMNS_STORAGE_KEY)));
  const saveHidden = (next: Set<string>) => {
    setHidden(next);
    writeStorage(COLUMNS_STORAGE_KEY, JSON.stringify([...next]));
  };
  const visibleColumns: ColumnDef[] = TABLE_COLUMNS.filter(
    (c) => !hidden.has(c.key) && !(fixedBoardId && c.key === 'board'),
  );

  // --- richiesta: filtri incompleti non vengono inviati, ma spiegati --------------------------
  const salaryIncomplete =
    (state.salaryMin !== '' || state.salaryMax !== '') &&
    (!/^[A-Za-z]{3}$/.test(state.currency) || !state.period);
  const salaryRange =
    state.salaryMin !== '' &&
    state.salaryMax !== '' &&
    Number(state.salaryMin) > Number(state.salaryMax);
  const datesInverted = state.from !== '' && state.to !== '' && state.from > state.to;
  const requestState: TableState = {
    ...state,
    ...(salaryIncomplete || salaryRange ? { salaryMin: '', salaryMax: '' } : {}),
    ...(datesInverted ? { from: '', to: '' } : {}),
  };
  const query = toApiQuery(requestState);
  const result = useOpportunities(query);

  const filtersOpenInitial =
    activeFilterCount(state, Boolean(fixedBoardId)) - (state.q.trim() ? 1 : 0) > 0;
  const [filtersOpen, setFiltersOpen] = useState(filtersOpenInitial);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const filtersId = useId();
  const columnsId = useId();
  const searchId = useId();

  const count = activeFilterCount(state, Boolean(fixedBoardId));
  const labelsById = useMemo(
    () => new Map((labels.data ?? []).map((l) => [l.id, l])),
    [labels.data],
  );
  const boardName =
    fixedBoardId !== undefined
      ? (board.data?.board.name ?? '')
      : ((boards.data ?? []).find((b) => b.id === state.board)?.name ?? '');
  const ctx: ResultContext = {
    labelsById,
    timeZone: workspace.timezone,
    // Il pannello si apre sotto la stessa rotta: ricerca, filtri e pagina restano nell'indirizzo.
    detailHref: (item) =>
      `${location.pathname.replace(/\/$/, '')}/cards/${item.id}${location.search}`,
  };

  const onSort = (column: ColumnDef) => {
    if (!column.sort) return;
    const sameKey = column.sort === state.sort;
    update({
      sort: column.sort,
      dir: sameKey
        ? state.dir === 'asc'
          ? 'desc'
          : 'asc'
        : readTableState(new URLSearchParams({ sort: column.sort })).dir,
    });
  };

  // --- contrassegni dei filtri attivi ----------------------------------------------------------
  const chips: { key: string; text: string; remove: () => void }[] = [];
  if (state.q.trim())
    chips.push({
      key: 'q',
      text: `Testo: “${state.q.trim()}”`,
      remove: () => {
        setInput('');
        update({ q: '' });
      },
    });
  if (!fixedBoardId && state.board) {
    chips.push({
      key: 'board',
      text: `Bacheca: ${boardName || '…'}`,
      remove: () => update({ board: '', column: '' }),
    });
  }
  if (state.column) {
    const name = board.data?.columns.find((c) => c.id === state.column)?.name ?? '…';
    chips.push({ key: 'column', text: `Colonna: ${name}`, remove: () => update({ column: '' }) });
  }
  for (const key of Object.keys(GROUP_TITLES) as (keyof typeof GROUP_TITLES)[]) {
    const values = state.lists[key];
    if (values.length === 0) continue;
    const names = values.map((v) =>
      key === 'label'
        ? (labelsById.get(v)?.name ?? '…')
        : v === 'none'
          ? 'non indicato'
          : (VALUE_LABELS[key]?.[v] ?? v),
    );
    chips.push({
      key,
      text: `${GROUP_TITLES[key]}: ${names.join(', ')}`,
      remove: () => update({ lists: { ...state.lists, [key]: [] } }),
    });
  }
  if (state.from || state.to) {
    chips.push({
      key: 'dates',
      text: `Candidatura: ${state.from ? `dal ${state.from}` : ''}${state.from && state.to ? ' ' : ''}${state.to ? `al ${state.to}` : ''}`,
      remove: () => update({ from: '', to: '' }),
    });
  }
  if (state.salaryMin || state.salaryMax) {
    const period = state.period
      ? ` ${PERIOD_LABELS[state.period as keyof typeof PERIOD_LABELS] ?? ''}`
      : '';
    chips.push({
      key: 'salary',
      text: `Retribuzione: ${state.salaryMin || '…'}–${state.salaryMax || '…'} ${state.currency}${period}`,
      remove: () => update({ salaryMin: '', salaryMax: '', currency: '', period: '' }),
    });
  }
  if (state.archived !== 'exclude') {
    chips.push({
      key: 'archived',
      text: state.archived === 'only' ? 'Solo archiviate' : 'Archiviate incluse',
      remove: () => update({ archived: 'exclude' }),
    });
  }

  const data = result.data;
  const loadingFirst = result.isPending;
  const refreshing = result.isFetching && !loadingFirst;
  const beyond = data !== undefined && data.total > 0 && data.items.length === 0;
  const clear = () => {
    setInput('');
    const cleared = clearFilters(state, Boolean(fixedBoardId));
    setPending({ state: cleared, base: urlKey });
    setParams(writeTableState(cleared));
  };

  return (
    <div className="space-y-4">
      <div role="search" className="space-y-2">
        <label htmlFor={searchId} className="block text-sm font-medium">
          {fixedBoardId ? 'Cerca in questa bacheca' : 'Cerca nelle opportunità'}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-64">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={searchId}
              type="search"
              value={input}
              maxLength={LIMITS.searchTextMax}
              autoComplete="off"
              placeholder="Titolo, azienda, posizione, descrizione, sede, fonte"
              className="pl-8"
              aria-describedby={`${searchId}-scope`}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <Filter aria-hidden="true" />
            Filtri
            {count > 0 ? <Badge tone="primary">{count}</Badge> : null}
          </Button>
          <Button
            variant="secondary"
            aria-expanded={columnsOpen}
            aria-controls={columnsId}
            onClick={() => setColumnsOpen((v) => !v)}
            className="max-md:hidden"
          >
            <Columns3 aria-hidden="true" />
            Colonne
          </Button>
        </div>
        <p id={`${searchId}-scope`} className="text-xs text-muted-foreground">
          Ambito:{' '}
          {fixedBoardId
            ? `bacheca “${boardName || '…'}”`
            : state.board
              ? `bacheca “${boardName || '…'}”`
              : 'tutte le bacheche'}
          . Ogni parola deve comparire in almeno un campo.
        </p>
      </div>

      <Surface id={filtersId} hidden={!filtersOpen} className="p-4">
        <FiltersPanel
          state={state}
          onChange={(patch) => update(patch)}
          labels={labels.data ?? []}
          columns={state.board ? board.data?.columns : undefined}
          salaryHint={
            salaryIncomplete
              ? 'Indica valuta (3 lettere) e periodicità per applicare il filtro.'
              : salaryRange
                ? 'L’importo minimo supera il massimo: filtro non applicato.'
                : null
          }
          dateHint={
            datesInverted ? 'La data finale precede quella iniziale: filtro non applicato.' : null
          }
        />
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" size="sm" disabled={count === 0} onClick={clear}>
            Cancella filtri
          </Button>
        </div>
      </Surface>

      <Surface id={columnsId} hidden={!columnsOpen} className="p-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Colonne visibili</legend>
          <p className="mb-2 text-xs text-muted-foreground">
            Preferenza salvata su questo dispositivo.
          </p>
          <ul className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
            {TABLE_COLUMNS.filter((c) => !(fixedBoardId && c.key === 'board')).map((column) => (
              <li key={column.key}>
                <label className="flex min-h-8 cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={!hidden.has(column.key)}
                    disabled={column.locked}
                    onChange={(e) => {
                      const next = new Set(hidden);
                      if (e.target.checked) next.delete(column.key);
                      else next.add(column.key);
                      saveHidden(next);
                    }}
                  />
                  {column.label}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <div className="mt-3 flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => saveHidden(parseHiddenColumns(null))}
          >
            Ripristina colonne predefinite
          </Button>
        </div>
      </Surface>

      {chips.length > 0 ? (
        <ul aria-label="Filtri attivi" className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <li key={chip.key}>
              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-surface py-0.5 pr-1 pl-2.5 text-xs">
                <span className="truncate">{chip.text}</span>
                <button
                  type="button"
                  onClick={chip.remove}
                  aria-label={`Rimuovi il filtro: ${chip.text}`}
                  className="grid size-6 place-items-center rounded-full hover:bg-surface-muted max-md:size-11"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
          <li>
            <Button variant="ghost" size="sm" onClick={clear}>
              Cancella filtri
            </Button>
          </li>
        </ul>
      ) : null}

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {loadingFirst
          ? 'Ricerca in corso…'
          : result.isError && !data
            ? ''
            : refreshing
              ? 'Aggiornamento…'
              : data
                ? `${data.total} ${data.total === 1 ? 'risultato' : 'risultati'}`
                : ''}
      </p>

      {loadingFirst ? (
        <div role="status" aria-label="Caricamento delle opportunità" className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : result.isError && !data ? (
        <Surface className="p-6" role="alert">
          <p className="font-semibold">Non riusciamo a caricare le opportunità.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            I tuoi dati sono al sicuro: riprova tra un momento.
          </p>
          <Button className="mt-4" variant="secondary" onClick={() => void result.refetch()}>
            Riprova
          </Button>
        </Surface>
      ) : data && data.total === 0 ? (
        <Surface className="px-6 py-10 text-center">
          <h2 className="text-base font-semibold">
            {count > 0 ? 'Nessun risultato' : 'Nessuna opportunità'}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {count > 0
              ? 'Nessuna opportunità corrisponde alla ricerca e ai filtri attivi. Prova ad allargarli o a toglierne qualcuno.'
              : fixedBoardId
                ? 'Questa bacheca non ha ancora schede. Aggiungile dalla vista Kanban.'
                : 'Non hai ancora schede: creane una da una bacheca e la ritroverai qui.'}
          </p>
          {count > 0 ? (
            <Button className="mt-4" variant="secondary" onClick={clear}>
              Cancella filtri
            </Button>
          ) : null}
        </Surface>
      ) : beyond ? (
        <Surface className="px-6 py-10 text-center">
          <h2 className="text-base font-semibold">Questa pagina non esiste più</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            I risultati sono cambiati: ripartiamo dalla prima pagina.
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => update({ page: 1 }, { keepPage: true })}
          >
            Vai alla prima pagina
          </Button>
        </Surface>
      ) : data ? (
        <>
          <ResultsTable
            items={data.items}
            columns={visibleColumns}
            state={state}
            onSort={onSort}
            ctx={ctx}
            busy={refreshing}
          />
          <ResultsList items={data.items} ctx={ctx} busy={refreshing} showBoard={!fixedBoardId} />
          {data.pageCount > 1 ? (
            <nav aria-label="Paginazione" className="flex items-center justify-between gap-3">
              <Button
                variant="secondary"
                disabled={data.page <= 1}
                onClick={() => update({ page: data.page - 1 }, { keepPage: true })}
              >
                Precedente
              </Button>
              <span className="text-sm text-muted-foreground">
                Pagina {data.page} di {data.pageCount}
              </span>
              <Button
                variant="secondary"
                disabled={data.page >= data.pageCount}
                onClick={() => update({ page: data.page + 1 }, { keepPage: true })}
              >
                Successiva
              </Button>
            </nav>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
