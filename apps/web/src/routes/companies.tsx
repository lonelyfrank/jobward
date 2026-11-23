import { Building2, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Select } from '@/components/ui/input';
import { Surface } from '@/components/ui/surface';
import { WorkspacePageHeader } from '@/components/ui/workspace-page-header';
import { useCompanies } from '@/features/companies/api';
import {
  COMPANY_SORT_LABELS,
  COMPANY_SORTS,
  filterAndSortCompanies,
  paginate,
  parseCompanySort,
  type CompanySort,
} from '@/features/companies/list';
import { useWorkspace } from '@/features/workspace/context';
import { useAvailableHeight } from '@/hooks/use-available-height';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';

/** Altezza fissa delle schede (px) e spazio tra le righe: servono a calcolare quante ne stanno. */
const CARD_HEIGHT = 92;
const GAP = 12;
/** Spazio riservato sotto la griglia per la paginazione. */
const PAGER_HEIGHT = 52;

/**
 * Aziende (B-05): ogni azienda con le sue opportunità e candidature, dal nome scritto sulle schede.
 * Le schede per pagina sono quante ne stanno nello spazio visibile (colonne × righe): la pagina non
 * scorre e si passa da una pagina all'altra con la paginazione centrata sotto. Ricerca, ordine e
 * pagina vivono nell'indirizzo.
 */
export function Component() {
  const { workspace } = useWorkspace();
  const companies = useCompanies();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const sort = parseCompanySort(params.get('ordine'));
  const requestedPage = Number(params.get('pagina') ?? '1');

  const gridRef = useRef<HTMLUListElement>(null);
  const available = useAvailableHeight(gridRef, PAGER_HEIGHT);
  const [columns, setColumns] = useState(1);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () =>
      setColumns(
        Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length),
      );
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [companies.isSuccess]);
  const rows = Math.max(1, Math.floor((available + GAP) / (CARD_HEIGHT + GAP)));
  // Prima della misura (o senza `<main>`, nei test) si mostra una pagina ragionevole.
  const pageSize = available > 0 ? rows * columns : 12;

  const filtered = useMemo(
    () => filterAndSortCompanies(companies.data ?? [], q, sort),
    [companies.data, q, sort],
  );
  const { items, page, pageCount } = paginate(filtered, requestedPage, pageSize);

  const update = (patch: { q?: string; ordine?: CompanySort; pagina?: number }) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const set = (key: string, value: string | null) =>
          value ? next.set(key, value) : next.delete(key);
        if (patch.q !== undefined) set('q', patch.q.trim() ? patch.q : null);
        if (patch.ordine !== undefined) set('ordine', patch.ordine === 'az' ? null : patch.ordine);
        // Nuova ricerca o nuovo ordine: si riparte dalla prima pagina.
        set('pagina', patch.pagina && patch.pagina > 1 ? String(patch.pagina) : null);
        return next;
      },
      { replace: patch.q !== undefined },
    );

  return (
    <>
      <WorkspacePageHeader title="Aziende" />
      {companies.isError ? (
        <Surface className="p-6" role="alert">
          Impossibile caricare le aziende.
        </Surface>
      ) : companies.isPending ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : (companies.data ?? []).length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nessuna azienda ancora"
          description="Scrivi il nome dell’azienda su un’opportunità: la trovi qui, collegata a tutte le opportunità con lo stesso nome."
        />
      ) : (
        <div className="space-y-3">
          {/* Barra compatta: serve solo a trovare in fretta una scheda. */}
          <div role="search" className="flex flex-wrap items-center gap-2">
            <div className="relative w-full min-w-0 sm:w-72">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <label htmlFor="company-search" className="sr-only">
                Cerca un’azienda
              </label>
              <Input
                id="company-search"
                type="search"
                value={q}
                placeholder="Cerca un’azienda"
                className="h-9 rounded-full pl-9 text-sm"
                onChange={(e) => update({ q: e.target.value })}
              />
            </div>
            <label htmlFor="company-sort" className="sr-only">
              Ordina le aziende
            </label>
            <Select
              id="company-sort"
              value={sort}
              className="h-9 w-auto rounded-full pr-8 pl-3.5 text-sm"
              onChange={(e) => update({ ordine: e.target.value as CompanySort })}
            >
              {COMPANY_SORTS.map((value) => (
                <option key={value} value={value}>
                  {COMPANY_SORT_LABELS[value]}
                </option>
              ))}
            </Select>
            <p role="status" className="text-xs text-muted-foreground sm:ml-auto">
              {filtered.length === (companies.data ?? []).length
                ? `${filtered.length} aziende`
                : `${filtered.length} di ${(companies.data ?? []).length} aziende`}
            </p>
          </div>

          <ul
            ref={gridRef}
            aria-label="Aziende"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          >
            {items.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/companies/${c.id}`}
                  className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-hover-soft"
                  style={{ height: CARD_HEIGHT }}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-foreground"
                  >
                    <Building2 className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold" title={c.name}>
                      {c.name}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {c.opportunities} opportunità · {c.applications}{' '}
                      {c.applications === 1 ? 'candidatura' : 'candidature'}
                      {c.activeApplications > 0 ? ` (${c.activeApplications} in corso)` : ''}
                    </span>
                    {c.lastActivityAt ? (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        Ultima attività: {formatDateTime(c.lastActivityAt, workspace.timezone)}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna azienda corrisponde alla ricerca.
            </p>
          ) : null}

          {pageCount > 1 ? (
            <Pager
              page={page}
              pageCount={pageCount}
              onChange={(next) => update({ pagina: next })}
            />
          ) : null}
        </div>
      )}
    </>
  );
}

/** Pagine con i numeri (al più 7, con «…»), precedente e successiva; centrata sotto la griglia. */
function Pager({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  const pages: (number | 'gap')[] = [];
  for (let n = 1; n <= pageCount; n++) {
    if (n === 1 || n === pageCount || Math.abs(n - page) <= 1) pages.push(n);
    else if (pages[pages.length - 1] !== 'gap') pages.push('gap');
  }
  const control =
    'grid h-8 min-w-8 place-items-center rounded-full px-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40 max-md:h-11 max-md:min-w-11';
  return (
    <nav aria-label="Pagine delle aziende" className="flex justify-center pt-1">
      <ul className="flex items-center gap-1 rounded-full bg-surface-muted p-1">
        <li>
          <button
            type="button"
            className={cn(control, 'hover:bg-surface')}
            aria-label="Pagina precedente"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
        </li>
        {pages.map((n, i) =>
          n === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={n}>
              <button
                type="button"
                aria-label={`Pagina ${n}`}
                aria-current={n === page ? 'page' : undefined}
                className={cn(
                  control,
                  n === page
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-surface hover:text-foreground',
                )}
                onClick={() => onChange(n)}
              >
                {n}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            className={cn(control, 'hover:bg-surface')}
            aria-label="Pagina successiva"
            disabled={page >= pageCount}
            onClick={() => onChange(page + 1)}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </li>
      </ul>
    </nav>
  );
}
