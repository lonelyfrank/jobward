import { Ellipsis, type LucideIcon } from 'lucide-react';
import { Fragment } from 'react';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

export type WorkspaceAction = {
  id: string;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
  onSelect: () => void;
};

export function WorkspaceActionsMenu({ actions }: { actions: WorkspaceAction[] }) {
  if (!actions.length) return null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          aria-label="Azioni della vista"
          className="size-11 rounded-full shadow-none hover:shadow-sm active:bg-primary-hover data-[state=open]:bg-primary-hover [&_svg]:size-[18px]"
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-w-[calc(100vw-1rem)]">
        {actions.map(({ id, label, icon: Icon, separator, ...props }, index) => (
          <Fragment key={id}>
            {separator && index > 0 ? <DropdownMenuSeparator /> : null}
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
