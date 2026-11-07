import { NavLink } from 'react-router';
import { LogoMark, Wordmark } from '@/components/brand/logo';
import { Tooltip } from '@/components/ui/tooltip';
import { useOverview } from '@/features/overview/api';
import { useWorkspace } from '@/features/workspace/context';
import { cn } from '@/lib/cn';
import { UserMenu } from './user-menu';
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
          className={cn(
            'flex h-11 items-center overflow-hidden rounded-md text-[15px] font-medium text-muted-foreground transition-[background-color,color,padding,gap] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-hover-soft hover:text-foreground aria-[current=page]:bg-primary-soft aria-[current=page]:font-semibold aria-[current=page]:text-primary-soft-foreground aria-[current=page]:hover:bg-primary-soft max-md:min-h-12',
            collapsed ? 'gap-0 px-[0.8125rem]' : 'gap-3 px-[9px]',
          )}
        >
          <Icon aria-hidden="true" className="size-[1.125rem] shrink-0" />
          <span
            className={cn(
              'overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-[150ms,300ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
              collapsed
                ? 'max-w-0 opacity-0 delay-0'
                : 'max-w-[160px] opacity-100 delay-[80ms,0ms]',
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
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className={cn(
          'relative flex shrink-0 items-center transition-[height,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          collapsed ? 'h-18 px-4' : 'h-[86px] px-6',
        )}
      >
        <span
          aria-hidden={collapsed}
          className={cn(
            'transition-opacity duration-150',
            collapsed ? 'opacity-0 delay-0' : 'opacity-100 delay-[80ms]',
          )}
        >
          <Wordmark className="w-[150px] max-w-none" />
        </span>
        <span
          aria-hidden={!collapsed}
          className={cn(
            'absolute left-1/2 -translate-x-1/2 transition-opacity duration-150',
            collapsed ? 'opacity-100 delay-[80ms]' : 'opacity-0 delay-0',
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
              'overflow-hidden px-6 text-[11px] font-semibold tracking-[0.16em] whitespace-nowrap text-muted-foreground uppercase transition-[max-height,padding,opacity] duration-[300ms,300ms,150ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
              collapsed
                ? 'max-h-0 pb-0 opacity-0 delay-0'
                : 'max-h-8 pb-3 opacity-100 delay-[0ms,0ms,80ms]',
            )}
          >
            Workspace
          </p>
          <ul
            className={cn(
              'flex flex-col px-2 transition-[gap] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              collapsed ? 'gap-1.5' : 'gap-2',
            )}
          >
            {NAV_ITEMS.map((item) => (
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
              'grid transition-[grid-template-rows,opacity] duration-[300ms,150ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
              collapsed
                ? 'grid-rows-[0fr] opacity-0 delay-0'
                : 'grid-rows-[1fr] opacity-100 delay-[0ms,80ms]',
            )}
          >
            <div className="overflow-hidden">
              <RecentBoards onNavigate={onNavigate} />
            </div>
          </div>
        </div>

        <div className="mt-auto shrink-0 border-t border-border p-2">
          <UserMenu collapsed={collapsed} onNavigate={onNavigate} />
        </div>
      </nav>
    </div>
  );
}
