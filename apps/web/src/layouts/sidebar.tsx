import { useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { LogoMark, Wordmark } from '@/components/brand/logo';
import { Tooltip } from '@/components/ui/tooltip';
import { useOverview } from '@/features/overview/api';
import { useWorkspace } from '@/features/workspace/context';
import { cn } from '@/lib/cn';
import { NAV_ITEMS, type NavItem } from './nav';

/** Sezione "Bacheche recenti": dati reali; senza bacheche mostra un suggerimento onesto. */
function RecentBoards({ onNavigate }: { onNavigate?: () => void }) {
  const { workspace } = useWorkspace();
  const overview = useOverview(workspace.id);
  const boards = overview.data?.recentBoards ?? [];

  return (
    <section aria-labelledby="sidebar-boards" className="mt-8 px-3">
      <h2
        id="sidebar-boards"
        className="px-3 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase"
      >
        Bacheche recenti
      </h2>
      {boards.length === 0 ? (
        <p className="mt-2 px-3 text-sm text-muted-foreground">
          Le bacheche che userai di più compariranno qui.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {boards.map((board) => (
            <li key={board.id}>
              <NavLink
                to={`/boards/${board.id}`}
                onClick={onNavigate}
                className="block truncate rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-hover-soft hover:text-foreground max-md:py-3"
              >
                {board.name}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SidebarLink({
  item: { to, label, icon: Icon, end },
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  // Radix Slot richiede una classe statica; aria-current conserva lo stile attivo.
  return (
    <li>
      <Tooltip content={label} disabled={!collapsed}>
        <NavLink
          to={to}
          end={end}
          onClick={onNavigate}
          className="flex h-11 items-center gap-3 overflow-hidden rounded-md px-[9px] text-[15px] font-medium text-muted-foreground transition-colors hover:bg-hover-soft hover:text-foreground aria-[current=page]:bg-primary-soft aria-[current=page]:font-semibold aria-[current=page]:text-primary-soft-foreground aria-[current=page]:hover:bg-primary-soft max-md:min-h-12"
        >
          <Icon aria-hidden="true" className="size-[1.125rem] shrink-0" />
          <span
            className={cn(
              'overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-[100ms,220ms] ease-in-out',
              collapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100',
            )}
          >
            {label}
          </span>
        </NavLink>
      </Tooltip>
    </li>
  );
}

export function Sidebar({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  // Come in Sensei: il testo sfuma subito, la sezione secondaria si richiude
  // dopo i 200 ms del restringimento. In apertura il contenuto torna subito.
  const [settledCollapsed, setSettledCollapsed] = useState(collapsed);
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(
      () => setSettledCollapsed(collapsed),
      collapsed && !reduceMotion ? 210 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [collapsed]);
  const contentCollapsed = collapsed && settledCollapsed;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="relative flex h-[86px] shrink-0 items-center px-6">
        <span
          aria-hidden={collapsed}
          className={cn('transition-opacity duration-100', collapsed && 'opacity-0')}
        >
          <Wordmark className="w-[150px] max-w-none" />
        </span>
        <span
          aria-hidden={!contentCollapsed}
          className={cn(
            'absolute left-3 transition-opacity duration-100',
            !contentCollapsed && 'opacity-0',
          )}
        >
          <LogoMark />
        </span>
      </div>

      <nav aria-label="Navigazione principale" className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <p
            aria-hidden={collapsed}
            className={cn(
              'px-6 pb-3 text-[11px] font-semibold tracking-[0.16em] whitespace-nowrap text-muted-foreground uppercase transition-opacity duration-100',
              collapsed && 'opacity-0',
            )}
          >
            Workspace
          </p>
          <ul className="space-y-2 px-2">
            {NAV_ITEMS.filter((item) => item.placement !== 'bottom').map((item) => (
              <SidebarLink
                key={item.to}
                item={item}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </ul>

          <div
            inert={collapsed}
            aria-hidden={collapsed}
            className={cn(
              'grid transition-[grid-template-rows,opacity] duration-200 ease-in-out',
              contentCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
              collapsed ? 'opacity-0' : 'opacity-100',
            )}
          >
            <div className="overflow-hidden">
              <RecentBoards onNavigate={onNavigate} />
            </div>
          </div>
        </div>

        <div className="mt-auto flex shrink-0 flex-col gap-3 px-2 pt-3 pb-5">
          <div className="mx-0.5 h-px bg-border" />
          <ul>
            {NAV_ITEMS.filter((item) => item.placement === 'bottom').map((item) => (
              <SidebarLink
                key={item.to}
                item={item}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
}
