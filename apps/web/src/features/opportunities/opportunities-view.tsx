import { SavedViewsBar } from '@/features/saved-views/saved-views-bar';
import { cn } from '@/lib/cn';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { LIMITS } from '@jobward/shared';
import { Filter, Map as MapIcon, Search, Table2, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
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
import { useAvailableHeight } from '@/hooks/use-available-height';
import { useOpportunities, useOpportunityCities } from './api';
import { FiltersPanel } from './filters-panel';
import { ViewSidebar } from './view-sidebar';
import { SidebarSection, sidebarCheckClass } from './sidebar-section';
import { ResultsList, ResultsTable, type ResultContext } from './results';
import {
  activeFilterCount,
  clearFilters,
  COLUMNS_STORAGE_KEY,
  parseHiddenColumns,
  readTableState,
  TABLE_COLUMNS,
  toApiQuery,
  toMapQuery,
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
  city: 'Città',
} as const;

const DEBOUNCE_MS = 300;

/** Vista Mappa (D-07) e confini incorporati: scaricati solo quando si sceglie la Mappa. */
const OpportunityMap = lazy(() => import('./map/opportunity-map'));

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
  // L'URL è l'unica fonte dei filtri. Il commit sincrono nelle azioni mantiene reattive le
  // spunte senza una copia ottimistica che possa sopravvivere a Back/Forward.
  const state = useMemo(
    () => (fixedBoardId ? { ...urlState, board: fixedBoardId } : urlState),
    [urlState, fixedBoardId],
  );

  const boards = useBoards();
  const cities = useOpportunityCities();
  const labels = useLabels();
  const board = useBoardDetail(state.board, state.board !== '');

  const update = (patch: Partial<TableState>, options: { keepPage?: boolean } = {}) => {
    const next: TableState = {
      ...state,
      ...patch,
      page: options.keepPage ? (patch.page ?? state.page) : 1,
    };
    const nextParams = writeTableState({
      ...next,
      board: fixedBoardId ? '' : next.board,
    });
    if (nextParams.toString() === urlKey) return;
    // Filtri, ordine e pagina sono passi di navigazione ("indietro" li annulla uno per volta);
    // la digitazione nella ricerca invece sostituisce la voce, per non riempire la cronologia.
    setParams(nextParams, { flushSync: true });
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
        flushSync: true,
      });
      setSyncedQ(input);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // Anche i filtri fanno parte della ricerca: un timer precedente non deve ripristinarli.
  }, [input, state, fixedBoardId, setParams]);

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
  const showMap = !fixedBoardId && state.layout === 'map';
  // Sotto i 1024 px ricerca e filtri della Mappa sono un pannello sovrapposto (nessuno scroll).
  const desktop = useMinWidth(1024);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
  const query = toApiQuery(requestState);
  // In vista Mappa l'elenco paginato non serve: nessuna richiesta inutile.
  const result = useOpportunities(query, !showMap);

  const searchId = useId();
  const resultsRef = useRef<HTMLDivElement>(null);
  const availableResults = useAvailableHeight(
    resultsRef,
    result.data && result.data.pageCount > 1 ? 64 : 0,
  );
  // Finestre molto basse: almeno 160 px di elenco, poi scorre la pagina.
  const resultsHeight = availableResults > 0 ? Math.max(160, availableResults) : undefined;

  const count = activeFilterCount(state, Boolean(fixedBoardId));
  const labelsById = useMemo(
    () => new Map((labels.data ?? []).map((l) => [l.id, l])),
    [labels.data],
  );
  const boardName =
    fixedBoardId !== undefined
      ? (board.data?.board.name ?? '')
      : ((boards.data ?? []).find((b) => b.id === state.board)?.name ?? '');
  const basePath = location.pathname.replace(/\/cards\/[^/]+\/?$/, '').replace(/\/$/, '');
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
    chips.push({
      key: 'column',
      text: `Colonna: ${name}`,
      remove: () => update({ column: '' }),
    });
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
    setParams(writeTableState(cleared), { flushSync: true });
  };

  const searchBlock = (
    <div role="search" className={showMap ? 'space-y-1.5' : 'space-y-2'}>
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
      </div>
      {/* In vista Mappa la spiegazione resta per i lettori di schermo ma non occupa spazio. */}
      <p id={`${searchId}-scope`} className={showMap ? 'sr-only' : 'text-xs text-muted-foreground'}>
        Ambito:{' '}
        {fixedBoardId
          ? `bacheca “${boardName || '…'}”`
          : state.board
            ? `bacheca “${boardName || '…'}”`
            : 'tutte le bacheche'}
        . Ogni parola deve comparire in almeno un campo.
      </p>
    </div>
  );

  return (
    <div
      className={cn(
        'grid min-w-0 items-start gap-5',
        // In vista Mappa il pannello dei filtri si richiude: la colonna segue la sua larghezza.
        showMap ? 'lg:grid-cols-[auto_minmax(0,1fr)]' : 'lg:grid-cols-[17rem_minmax(0,1fr)]',
      )}
    >
      <ViewSidebar
        count={count}
        flyout={showMap}
        sheetOpen={filtersSheetOpen}
        onSheetOpenChange={setFiltersSheetOpen}
        search={showMap ? searchBlock : undefined}
        filters={
          <>
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-xs text-muted-foreground">
                {count ? `${count} attivi` : 'Nessun filtro attivo'}
              </span>
              <Button variant="secondary" size="sm" disabled={count === 0} onClick={clear}>
                Cancella filtri
              </Button>
            </div>
            {chips.length > 0 ? (
              <SidebarSection title="Filtri attivi" count={chips.length} defaultOpen>
                <ul aria-label="Filtri attivi" className="space-y-2">
                  {chips.map((chip) => (
                    <li key={chip.key} className="min-w-0">
                      <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-surface py-0.5 pr-1 pl-2.5 text-xs">
                        <span className="min-w-0 break-words">{chip.text}</span>
                        <button
                          type="button"
                          onClick={chip.remove}
                          aria-label={`Rimuovi il filtro: ${chip.text}`}
                          className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-surface-muted max-md:size-11"
                        >
                          <X aria-hidden="true" className="size-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </SidebarSection>
            ) : null}
            <FiltersPanel
              state={state}
              onChange={(patch) => update(patch)}
              labels={labels.data ?? []}
              boards={fixedBoardId ? undefined : (boards.data ?? [])}
              columns={state.board ? board.data?.columns : undefined}
              cities={cities.data?.cities}
              citiesFirst={showMap}
              salaryHint={
                salaryIncomplete
                  ? 'Indica valuta (3 lettere) e periodicità per applicare il filtro.'
                  : salaryRange
                    ? 'L’importo minimo supera il massimo: filtro non applicato.'
                    : null
              }
              dateHint={
                datesInverted
                  ? 'La data finale precede quella iniziale: filtro non applicato.'
                  : null
              }
            />
          </>
        }
        columns={
          showMap ? undefined : (
            <>
              <fieldset className="min-w-0">
                <legend className="sr-only">Colonne visibili</legend>
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  Preferenza salvata su questo dispositivo.
                </p>
                {[
                  {
                    title: 'Informazioni generali',
                    keys: ['title', 'company', 'board', 'column', 'priority', 'labels'],
                  },
                  {
                    title: 'Dettagli del lavoro',
                    keys: ['location', 'workMode', 'contractType', 'salary'],
                  },
                  {
                    title: 'Candidatura e aggiornamenti',
                    keys: ['stage', 'outcome', 'appliedOn', 'updatedAt'],
                  },
                ]
                  .map((group) => ({
                    ...group,
                    columns: TABLE_COLUMNS.filter(
                      (c) => group.keys.includes(c.key) && !(fixedBoardId && c.key === 'board'),
                    ),
                  }))
                  .map((group) => (
                    <SidebarSection
                      key={group.title}
                      title={group.title}
                      defaultOpen
                      count={group.columns.filter((c) => !hidden.has(c.key)).length}
                    >
                      <ul className="space-y-1">
                        {group.columns.map((column) => (
                          <li key={column.key}>
                            <label className={sidebarCheckClass}>
                              <input
                                type="checkbox"
                                className="size-4 shrink-0 accent-primary"
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
                    </SidebarSection>
                  ))}
              </fieldset>
              <div className="mt-3 px-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-auto min-h-9 w-full whitespace-normal"
                  onClick={() => saveHidden(parseHiddenColumns(null))}
                >
                  Ripristina colonne predefinite
                </Button>
              </div>
              <p className="px-3 pt-3 text-xs text-muted-foreground md:hidden">
                Le colonne personalizzano la tabella su tablet e desktop. Sul telefono mostriamo un
                elenco compatto.
              </p>
            </>
          )
        }
      />
      <div className="min-w-0 space-y-4">
        {!fixedBoardId ? (
          // Ambito e rappresentazione sulla stessa riga: più spazio in altezza per la Mappa.
          <div className="flex flex-wrap items-center justify-between gap-2">
            {showMap && !desktop ? (
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={filtersSheetOpen}
                aria-label={
                  count > 0 ? `Apri ricerca e filtri (${count} attivi)` : 'Apri ricerca e filtri'
                }
                title="Ricerca e filtri"
                onClick={() => setFiltersSheetOpen(true)}
                className="relative grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted text-foreground hover:bg-primary-soft hover:text-primary-soft-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-md:size-11"
              >
                <Filter aria-hidden="true" className="size-4" />
                {count > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground"
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            ) : null}
            <SegmentedControl label="Vista delle opportunità" value={state.scope}>
              {(
                [
                  ['all', 'Tutte'],
                  ['inbox', 'Inbox'],
                  ['applications', 'Candidature'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={state.scope === value}
                  onClick={() => update({ scope: value })}
                  className={cn(
                    'relative z-10 inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold transition-colors max-md:min-h-11',
                    state.scope === value
                      ? 'text-primary-soft-foreground'
                      : 'text-muted-foreground hover:bg-surface hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </SegmentedControl>
            <SegmentedControl label="Rappresentazione dei risultati" value={state.layout}>
              {(
                [
                  ['table', 'Tabella', Table2],
                  ['map', 'Mappa', MapIcon],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={state.layout === value}
                  onClick={() => update({ layout: value }, { keepPage: true })}
                  className={cn(
                    'relative z-10 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors max-md:min-h-11',
                    state.layout === value
                      ? 'text-primary-soft-foreground'
                      : 'text-muted-foreground hover:bg-surface hover:text-foreground',
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                </button>
              ))}
            </SegmentedControl>
          </div>
        ) : null}
        {!fixedBoardId ? (
          <SavedViewsBar
            singleRow={showMap}
            current={writeTableState({ ...state, page: 1 }).toString()}
            basePath={location.pathname.replace(/\/cards\/[^/]+\/?$/, '')}
          />
        ) : null}
        {!fixedBoardId && !showMap && state.scope === 'inbox' ? (
          <p className="text-sm text-muted-foreground">
            Inbox: opportunità salvate per cui non hai ancora inviato una candidatura. Aprine una e
            usa «Candidati» quando decidi di procedere.
          </p>
        ) : null}

        {showMap ? null : searchBlock}

        {showMap ? (
          <Suspense
            fallback={
              <div role="status" aria-label="Caricamento della mappa" className="space-y-3">
                <Skeleton className="h-10" />
                <Skeleton className="h-[28rem] w-full" />
              </div>
            }
          >
            <OpportunityMap
              query={toMapQuery(requestState)}
              detailHref={(id, hash = '') => `${basePath}/cards/${id}${location.search}${hash}`}
            />
          </Suspense>
        ) : null}

        {showMap ? null : (
          <>
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
                {/* Tabella ed elenco scorrono al loro interno fino al fondo dello schermo; sotto resta
                    solo la paginazione. */}
                <div ref={resultsRef}>
                  <ResultsTable
                    items={data.items}
                    columns={visibleColumns}
                    state={state}
                    onSort={onSort}
                    ctx={ctx}
                    busy={refreshing}
                    maxHeight={resultsHeight}
                  />
                  <ResultsList
                    items={data.items}
                    ctx={ctx}
                    busy={refreshing}
                    showBoard={!fixedBoardId}
                    maxHeight={resultsHeight}
                  />
                </div>
                {data.pageCount > 1 ? (
                  <nav
                    aria-label="Paginazione"
                    className="flex flex-wrap items-center justify-between gap-3"
                  >
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
          </>
        )}
      </div>
    </div>
  );
}

/** `true` da `px` di larghezza in su; segue i cambi di finestra. */
function useMinWidth(px: number) {
  const query = `(min-width: ${px}px)`;
  const [matches, setMatches] = useState(() =>
    typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : true,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    const change = () => setMatches(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, [query]);
  return matches;
}
