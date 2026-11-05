import { Menu, Plus, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useWorkspaceControls } from '@/features/workspace/workspace-controls';
import { cn } from '@/lib/cn';
import { Button } from './button';
import { Tooltip } from './tooltip';
import { WorkspaceActionsMenu, type WorkspaceAction } from './workspace-actions-menu';

export function WorkspacePageHeader({
  title,
  description,
  navigation,
  actions = [],
  canCreateCard = false,
  boardId,
  children,
  className,
}: {
  title: string;
  description?: string;
  navigation?: ReactNode;
  actions?: WorkspaceAction[];
  canCreateCard?: boolean;
  boardId?: string;
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
    <header data-testid="workspace-page-header" className={cn('mb-8', className)}>
      {navigation ? <div className="mb-2">{navigation}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-48 items-start gap-2">
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
            <h1 className="text-3xl leading-tight font-extrabold tracking-tight break-words">
              {title}
            </h1>
            {description ? (
              <p className="mt-2.5 text-[15px] text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Tooltip content="Cerca in Jobward" side="bottom">
            <Button
              variant="secondary"
              size="icon"
              className="size-11 active:bg-hover-soft"
              aria-label="Cerca in Jobward"
              aria-keyshortcuts="Control+K Meta+K"
              onClick={openSearch}
            >
              <Search aria-hidden="true" />
            </Button>
          </Tooltip>
          <WorkspaceActionsMenu actions={menu} />
        </div>
      </div>
      {children ? <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}
