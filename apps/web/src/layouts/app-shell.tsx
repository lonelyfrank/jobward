import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useMatches } from 'react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sheet } from '@/components/ui/sheet';
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed';
import { cn } from '@/lib/cn';
import type { RouteHandle } from './nav';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/**
 * Struttura dell'app: sidebar (comprimibile; drawer su mobile), topbar e area principale.
 * Il pannello di dettaglio delle schede si innesterà accanto a <main> in M1.
 */
export function AppShell() {
  const { collapsed, toggle } = useSidebarCollapsed();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const matches = useMatches();
  const title = (matches.at(-1)?.handle as RouteHandle | undefined)?.title ?? 'Meet Roulette';
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    document.title = `${title} · Meet Roulette`;
  }, [title]);

  // Dopo una navigazione lato client sposta il focus sul contenuto: chi usa tastiera o
  // screen reader sa che la vista è cambiata. Non al primo caricamento.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo?.(0, 0);
  }, [location.pathname]);

  return (
    <TooltipProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Vai al contenuto
      </a>

      <div className="flex h-dvh overflow-hidden">
        <aside
          className={cn(
            'hidden shrink-0 border-r border-border bg-sidebar transition-[width] duration-150 md:block',
            collapsed ? 'w-16' : 'w-64',
          )}
        >
          <Sidebar collapsed={collapsed} onToggleCollapsed={toggle} />
        </aside>

        <Sheet open={navOpen} onOpenChange={setNavOpen} title="Menu di navigazione">
          <Sidebar onNavigate={() => setNavOpen(false)} />
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar title={title} onOpenNav={() => setNavOpen(true)} />
          <main
            id="main"
            ref={mainRef}
            tabIndex={-1}
            className="flex-1 overflow-y-auto px-4 py-6 outline-none sm:px-8"
          >
            <div className="mx-auto max-w-6xl animate-[mr-fade-in_0.15s_ease-out]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
