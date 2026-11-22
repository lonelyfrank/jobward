import { Columns3, Filter } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/** Nel flusso del layout: la navigazione principale riserva sempre la propria larghezza. */
export function ViewSidebar({
  count,
  filters,
  columns,
}: {
  count: number;
  filters: ReactNode;
  columns: ReactNode;
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
  const expanded = desktop || mobileOpen;

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
      sidebar.style.maxHeight = `${Math.max(160, window.innerHeight - Math.max(20, top) - 20)}px`;
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

  return (
    <aside
      ref={sidebarRef}
      aria-label="Personalizza opportunità"
      className="min-w-0 self-start overflow-hidden rounded-xl border border-border bg-surface shadow-sm lg:sticky lg:top-5 lg:flex lg:max-h-[calc(100dvh-2.5rem)] lg:flex-col"
    >
      <div className="shrink-0 space-y-3 p-3">
        <h2 className="px-1 text-sm font-semibold">Personalizza vista</h2>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-muted p-1">
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
        </div>
      </div>
      <div
        hidden={!expanded}
        className="min-h-0 overflow-y-auto overscroll-contain border-t border-border p-2 max-lg:max-h-[60dvh] [scrollbar-gutter:stable]"
      >
        <div id={`${id}-filters`} hidden={section !== 'filters'}>
          {filters}
        </div>
        <div id={`${id}-columns`} hidden={section !== 'columns'}>
          {columns}
        </div>
      </div>
    </aside>
  );
}
