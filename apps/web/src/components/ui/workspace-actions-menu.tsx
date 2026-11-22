import { Ellipsis, type LucideIcon } from 'lucide-react';
import { Fragment } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

/**
 * Sezioni del menu, nell'ordine in cui compaiono. Il layout è uguale in ogni vista: cambiano
 * solo le voci presenti, mai la posizione della sezione a cui appartengono.
 */
export const ACTION_GROUPS = ['create', 'navigate', 'view', 'manage', 'danger'] as const;
export type WorkspaceActionGroup = (typeof ACTION_GROUPS)[number];

export type WorkspaceAction = {
  id: string;
  label: string;
  /** Crea (nuove schede, colonne…), Naviga, Vista (aspetto e contenuti), Gestisci, Pericolo. */
  group: WorkspaceActionGroup;
  icon?: LucideIcon;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
};

export function WorkspaceActionsMenu({
  actions,
  className,
}: {
  actions: WorkspaceAction[];
  className?: string;
}) {
  if (!actions.length) return null;
  // Ordinamento stabile: dentro una sezione resta l'ordine con cui la vista ha dichiarato le voci.
  const sorted = [...actions].sort(
    (a, b) => ACTION_GROUPS.indexOf(a.group) - ACTION_GROUPS.indexOf(b.group),
  );
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          aria-label="Azioni della vista"
          className={cn(
            'size-11 rounded-full shadow-none hover:shadow-sm active:bg-primary-hover data-[state=open]:bg-primary-hover [&_svg]:size-[18px]',
            className,
          )}
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-w-[calc(100vw-1rem)]">
        {sorted.map(({ id, label, icon: Icon, group, ...props }, index) => (
          <Fragment key={id}>
            {index > 0 && sorted[index - 1]!.group !== group ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem {...props}>
              {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
              {label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
