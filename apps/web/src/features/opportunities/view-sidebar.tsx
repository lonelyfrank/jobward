import { ChevronsLeft, Columns3, Filter, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import { readStorage, writeStorage } from '@/lib/storage';

/** Pannello dei filtri della vista Mappa aperto o chiuso: preferenza di questo dispositivo. */
const FLYOUT_STORAGE_KEY = 'jobward.map.filters-open.v1';

/**
 * Nel flusso del layout: la navigazione principale riserva sempre la propria larghezza.
 *
 * Con `flyout` (vista Mappa) il pannello contiene ricerca e filtri, senza le colonne della tabella,
 * e da 1024 px si richiude in un pulsante rotondo: la mappa si allarga nello spazio liberato. Sotto
 * i 1024 px è un pannello sovrapposto (`sheetOpen`), aperto dal pulsante nella riga dei selettori,
 * così la vista resta in una sola schermata.
 */
export function ViewSidebar({
  count,
  filters,
  columns,
  search,
  flyout = false,
  sheetOpen = false,
  onSheetOpenChange,
}: {
  count: number;
  filters: ReactNode;
  columns?: ReactNode;
  /** Ricerca mostrata in cima al pannello (vista Mappa). */
  search?: ReactNode;
  flyout?: boolean;
  sheetOpen?: boolean;
  onSheetOpenChange?: (open: boolean) => void;
}) {
  const [desktop, setDesktop] = useState(() =>
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1024px)').matches
      : true,
  );
  const [mobileOpen, setMobileOpen] = useState(count > 0);
  const [section, setSection] = useState<'filters' | 'columns'>('filters');
  const id = useId();
  const sidebarRef = useRef<HTMLElement>(null);
  // Senza una scelta salvata il pannello parte aperto solo dove c'è spazio per mappa e pannello
  // affiancati anche con i filtri visibili (da 1280 px).
  const [flyoutOpen, setFlyoutOpen] = useState(() => {
    const saved = readStorage(FLYOUT_STORAGE_KEY);
    return saved === null ? window.innerWidth >= 1280 : saved !== 'closed';
  });
  const toggleFlyout = (open: boolean) => {
    setFlyoutOpen(open);
    writeStorage(FLYOUT_STORAGE_KEY, open ? 'open' : 'closed');
  };
  const drawer = flyout && desktop;
  const sheet = flyout && !desktop;
  const hasColumns = columns !== undefined && !flyout;
  const expanded = desktop || mobileOpen || sheet;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(min-width: 1024px)');
    const change = () => setDesktop(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  // L'intestazione può andare a capo o cambiare altezza nella vista di una bacheca.
  // Misuriamo il suo spazio reale, lasciando un margine anche sotto il pannello.
  useLayoutEffect(() => {
    const sidebar = sidebarRef.current;
    const grid = sidebar?.parentElement;
    const main = sidebar?.closest('main');
    if (!desktop || !sidebar || !grid || !main) return;
    const resize = () => {
      const top = grid.getBoundingClientRect().top + main.scrollTop;
      // Fino al margine inferiore reale dell'area principale: il pannello non allunga la pagina.
      const bottom = Number.parseFloat(getComputedStyle(main).paddingBottom) || 20;
      sidebar.style.maxHeight = `${Math.max(160, window.innerHeight - Math.max(20, top) - bottom)}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(main);
    observer.observe(grid);
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
      sidebar.style.removeProperty('max-height');
    };
  }, [desktop]);

  const select = (next: typeof section) => {
    setMobileOpen(section !== next || !mobileOpen);
    setSection(next);
  };

  const panel = (
    <aside
      ref={sidebarRef}
      aria-label="Personalizza opportunità"
      // Pannello chiuso: fuori dalla tabulazione e dall'albero di accessibilità.
      inert={drawer && !flyoutOpen}
      className={cn(
        'min-w-0 self-start overflow-hidden rounded-xl border border-border bg-surface shadow-sm lg:flex lg:max-h-[calc(100dvh-2.5rem)] lg:flex-col',
        sheet
          ? 'flex h-full min-h-0 flex-col rounded-none border-0 shadow-none'
          : drawer
            ? cn(
                // Larghezza fissa: il contenuto non si riflette mentre il contenitore si allarga.
                'w-[17rem] transition-[opacity,transform,visibility] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
                flyoutOpen
                  ? 'visible translate-x-0 opacity-100 delay-75 duration-300'
                  : 'invisible -translate-x-3 opacity-0 duration-200',
              )
            : 'lg:sticky lg:top-5',
      )}
    >
      <div className="shrink-0 space-y-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="px-1 text-sm font-semibold">
            {flyout ? 'Ricerca e filtri' : 'Personalizza vista'}
          </h2>
          {flyout && desktop ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Chiudi ricerca e filtri"
              title="Chiudi per allargare la mappa"
              onClick={() => toggleFlyout(false)}
            >
              <ChevronsLeft aria-hidden="true" />
            </Button>
          ) : sheet ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Chiudi ricerca e filtri"
              onClick={() => onSheetOpenChange?.(false)}
            >
              <X aria-hidden="true" />
            </Button>
          ) : null}
        </div>
        {search}
        <div
          className={cn(
            'grid gap-1 rounded-lg bg-surface-muted p-1',
            hasColumns ? 'grid-cols-2' : 'grid-cols-1',
            // Nel pannello della Mappa c'è solo «Filtri»: nessun selettore di sezione.
            flyout && 'hidden',
          )}
        >
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={expanded && section === 'filters'}
            aria-controls={`${id}-filters`}
            onClick={() => select('filters')}
            className={cn(
              'min-w-0 gap-1.5 px-2',
              section === 'filters' && 'bg-primary-soft text-primary-soft-foreground',
            )}
          >
            <Filter aria-hidden="true" />
            Filtri
            {count > 0 ? <Badge tone="primary">{count}</Badge> : null}
          </Button>
          {hasColumns ? (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={expanded && section === 'columns'}
              aria-controls={`${id}-columns`}
              onClick={() => select('columns')}
              className={cn(
                'min-w-0 gap-1.5 px-2',
                section === 'columns' && 'bg-primary-soft text-primary-soft-foreground',
              )}
            >
              <Columns3 aria-hidden="true" />
              Colonne
            </Button>
          ) : null}
        </div>
      </div>
      <div
        hidden={!expanded}
        className={cn(
          'min-h-0 overflow-y-auto overscroll-contain border-t border-border p-2 [scrollbar-gutter:stable]',
          sheet ? 'flex-1' : 'max-lg:max-h-[60dvh]',
        )}
      >
        <div id={`${id}-filters`} hidden={hasColumns && section !== 'filters'}>
          {filters}
        </div>
        {hasColumns ? (
          <div id={`${id}-columns`} hidden={section !== 'columns'}>
            {columns}
          </div>
        ) : null}
      </div>
    </aside>
  );

  if (sheet) {
    return (
      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => onSheetOpenChange?.(open)}
        title="Ricerca e filtri"
        hideFrom="lg"
      >
        {panel}
      </Sheet>
    );
  }
  if (!drawer) return panel;

  // Vista Mappa su desktop: il contenitore anima la larghezza (pulsante rotondo ↔ 17rem) e la mappa
  // si allarga o si restringe con lui; il pannello entra ed esce con dissolvenza e scorrimento.
  return (
    <div
      className={cn(
        'relative self-start overflow-hidden lg:sticky lg:top-5',
        'transition-[width] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
        flyoutOpen ? 'w-[17rem]' : 'w-10',
      )}
    >
      <button
        type="button"
        inert={flyoutOpen}
        aria-expanded={false}
        aria-label={count > 0 ? `Apri ricerca e filtri (${count} attivi)` : 'Apri ricerca e filtri'}
        title="Ricerca e filtri"
        onClick={() => toggleFlyout(true)}
        className={cn(
          // Stessa altezza del selettore Tutte/Inbox/Candidature accanto (40 px), rotondo.
          'absolute top-0 left-0 z-10 grid size-10 place-items-center rounded-full bg-surface-muted text-foreground transition-[opacity,transform,background-color] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-primary-soft hover:text-primary-soft-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none',
          flyoutOpen
            ? 'pointer-events-none scale-75 opacity-0 duration-150'
            : 'scale-100 opacity-100 delay-200 duration-300',
        )}
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
      {panel}
    </div>
  );
}
