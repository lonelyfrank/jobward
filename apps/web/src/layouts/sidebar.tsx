import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLink } from 'react-router';
import { LogoMark, Wordmark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useOverview } from '@/features/overview/api';
import { useWorkspace } from '@/features/workspace/context';
import { cn } from '@/lib/cn';
import { NAV_ITEMS } from './nav';

/** Sezione "Bacheche recenti": dati reali; senza bacheche mostra un suggerimento onesto. */
function RecentBoards() {
  const { workspace } = useWorkspace();
  const overview = useOverview(workspace.id);
  const boards = overview.data?.recentBoards ?? [];

  return (
    <section aria-labelledby="sidebar-boards" className="mt-6 px-3">
      <h2
        id="sidebar-boards"
        className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        Bacheche recenti
      </h2>
      {boards.length === 0 ? (
        <p className="mt-2 px-2 text-sm text-muted-foreground">
          Le bacheche che userai di più compariranno qui.
        </p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {boards.map((board) => (
            <li key={board.id}>
              <NavLink
                to={`/boards/${board.id}`}
                className="block truncate rounded-md px-2 py-1.5 text-sm hover:bg-surface-muted max-md:py-3"
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

export function Sidebar({
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  /** Presente solo nella versione desktop. */
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div
        className={cn('flex h-14 shrink-0 items-center px-4', collapsed && 'justify-center px-0')}
      >
        {collapsed ? <LogoMark /> : <Wordmark />}
      </div>

      <nav aria-label="Navigazione principale" className="px-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => {
            const link = (
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors max-md:py-3',
                    isActive
                      ? 'bg-primary-soft text-primary-soft-foreground'
                      : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                    collapsed && 'justify-center px-0',
                  )
                }
              >
                <Icon aria-hidden="true" className="size-[1.125rem] shrink-0" />
                <span className={cn(collapsed && 'sr-only')}>{label}</span>
              </NavLink>
            );
            return <li key={to}>{collapsed ? <Tooltip content={label}>{link}</Tooltip> : link}</li>;
          })}
        </ul>
      </nav>

      {collapsed ? null : <RecentBoards />}

      {onToggleCollapsed ? (
        <div className={cn('mt-auto p-3', collapsed && 'flex justify-center')}>
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'sm'}
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Espandi la barra laterale' : 'Comprimi la barra laterale'}
            aria-expanded={!collapsed}
            className={cn(!collapsed && 'w-full justify-start text-muted-foreground')}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
            {collapsed ? null : 'Comprimi'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
