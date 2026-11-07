import { ChevronLeft, Menu, Plus, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useWorkspaceControls } from '@/features/workspace/workspace-controls';
import { cn } from '@/lib/cn';
import { Button } from './button';
import { Tooltip } from './tooltip';
import { WorkspaceActionsMenu, type WorkspaceAction } from './workspace-actions-menu';

export function WorkspacePageHeader({
  title,
  description,
  navigation,
  backLink,
  actions = [],
  canCreateCard = false,
  boardId,
  controls,
  children,
  className,
}: {
  title: string;
  description?: string;
  navigation?: ReactNode;
  backLink?: { to: string; label: string };
  actions?: WorkspaceAction[];
  canCreateCard?: boolean;
  boardId?: string;
  controls?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { setMenuButton, onOpenNav, openSearch, createCard } = useWorkspaceControls();
  const menu = canCreateCard
    ? [
        {
          id: 'create-card',
          label: 'Nuova scheda',
          icon: Plus,
          onSelect: () => createCard(boardId),
        },
        ...actions,
      ]
    : actions;
  return (
    <header data-testid="workspace-page-header" className={cn('mb-5', className)}>
      {navigation ? <div className="mb-2">{navigation}</div> : null}
      <div
        className={cn(
          'grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-2',
          controls && 'lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]',
        )}
      >
        <div className="flex min-w-0 items-start gap-2">
          <Button
            ref={setMenuButton}
            variant="ghost"
            size="icon"
            className="-ml-2 md:hidden"
            aria-label="Apri il menu di navigazione"
            onClick={onOpenNav}
          >
            <Menu aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <h1 className="min-h-11 py-1.5 text-2xl leading-tight font-extrabold tracking-tight break-words">
              {title}
            </h1>
            {description ? (
              <p className="mt-0.5 max-w-3xl text-sm leading-5 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        <Tooltip content="Cerca in Jobward" side="bottom">
          <Button
            variant="ghost"
            size="icon"
            className="size-11 rounded-full bg-surface-muted text-foreground hover:bg-primary-soft hover:text-primary-soft-foreground active:bg-primary-soft [&_svg]:size-[18px]"
            aria-label="Cerca in Jobward"
            aria-keyshortcuts="Control+K Meta+K"
            onClick={openSearch}
          >
            <Search aria-hidden="true" />
          </Button>
        </Tooltip>
        {controls ? (
          <div className="col-span-full row-start-2 flex flex-wrap items-center gap-2 lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:min-h-11">
            {controls}
          </div>
        ) : null}
        <div
          className={cn(
            'col-start-3 row-start-1 flex items-center gap-2',
            controls && 'lg:col-start-4',
          )}
        >
          {backLink ? (
            <Tooltip content={backLink.label} side="bottom">
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="size-11 rounded-full bg-surface-muted text-foreground hover:bg-primary-soft hover:text-primary-soft-foreground active:bg-primary-soft [&_svg]:size-[18px]"
              >
                <Link to={backLink.to} aria-label={backLink.label}>
                  <ChevronLeft aria-hidden="true" />
                </Link>
              </Button>
            </Tooltip>
          ) : null}
          <WorkspaceActionsMenu actions={menu} />
        </div>
      </div>
      {children ? (
        <div className="mt-2 flex min-h-11 flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </header>
  );
}
