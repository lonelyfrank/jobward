import { ChevronRight, LifeBuoy, Settings, UserRound } from 'lucide-react';
import { useRef } from 'react';
import { NavLink, useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkspace } from '@/features/workspace/context';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/cn';

const ACCOUNT_LINKS = [
  { to: '/profile', label: 'Profilo', icon: UserRound },
  { to: '/settings', label: 'Impostazioni', icon: Settings },
] as const;

export function UserMenu({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { user, workspace } = useWorkspace();
  const name = user.email.split('@')[0] || user.email;
  const navigating = useRef(false);
  const { pathname } = useLocation();

  return (
    // Non modale: il menu è un popover. Un menu modale nasconde tutta l'app con aria-hidden
    // (axe: aria-hidden-focus) e blocca lo scroll iniettando uno <style> (incompatibile con una CSP stretta).
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'w-full min-w-0 justify-start overflow-hidden rounded-lg px-2 text-left transition-[height,gap,background-color,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-hover-soft data-[state=open]:bg-hover-soft',
            collapsed ? 'h-11 gap-0' : 'h-14 gap-3',
          )}
        >
          <span className="sr-only">Menu account </span>
          <UserAvatar email={user.email} className="size-7" />
          <span
            aria-hidden={collapsed}
            className={cn(
              'min-w-0 flex-1 overflow-hidden transition-[opacity,max-width] duration-[150ms,300ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
              collapsed
                ? 'max-w-0 opacity-0 delay-0'
                : 'max-w-[160px] opacity-100 delay-[80ms,0ms]',
            )}
          >
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {workspace.name}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={collapsed ? 'right' : 'top'}
        align={collapsed ? 'end' : 'start'}
        className="w-72 min-w-0 max-w-[calc(100vw-1rem)] rounded-[20px] p-2 shadow-lg"
        aria-label="Menu account"
        aria-labelledby={undefined}
        onCloseAutoFocus={(event) => {
          if (navigating.current) {
            event.preventDefault();
            navigating.current = false;
          }
        }}
      >
        <DropdownMenuLabel className="flex items-center gap-3 px-3 py-3">
          <UserAvatar email={user.email} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{name}</span>
            <span className="block truncate text-xs">{user.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ACCOUNT_LINKS.map(({ to, label, icon: Icon }) => (
          <DropdownMenuItem
            key={to}
            asChild
            className="gap-3 rounded-xl px-3 py-3 text-[15px] data-[highlighted]:bg-hover-soft data-[highlighted]:text-foreground"
            onSelect={() => {
              navigating.current = pathname !== to;
            }}
          >
            <NavLink to={to} end onClick={onNavigate}>
              <Icon aria-hidden="true" className="size-[18px]" />
              {label}
            </NavLink>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          asChild
          className="gap-3 rounded-xl px-3 py-3 text-[15px] data-[highlighted]:bg-hover-soft data-[highlighted]:text-foreground"
          onSelect={() => {
            navigating.current = pathname !== '/help';
          }}
        >
          <NavLink to="/help" onClick={onNavigate}>
            <LifeBuoy aria-hidden="true" className="size-[18px]" />
            Aiuto
            <ChevronRight aria-hidden="true" className="ml-auto size-4 text-muted-foreground" />
          </NavLink>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
