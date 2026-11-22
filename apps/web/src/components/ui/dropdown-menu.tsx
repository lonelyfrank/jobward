import { DropdownMenu as Menu } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuRadioGroup = Menu.RadioGroup;

export function DropdownMenuContent({ className, ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        align="end"
        sideOffset={6}
        // Il menu non supera mai lo spazio disponibile nella finestra: se serve scorre al suo interno
        // (altrimenti le voci in fondo restano fuori dallo schermo e non sono raggiungibili).
        collisionPadding={8}
        className={cn(
          'z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-56 origin-(--radix-dropdown-menu-content-transform-origin) overflow-y-auto rounded-lg border border-border bg-surface p-1.5 text-sm shadow-[0_12px_32px_-8px_oklch(0.2_0.05_280/0.25)] data-[state=closed]:animate-[jobward-pop-out_100ms_ease-in_both] data-[state=open]:animate-[jobward-pop-in_160ms_cubic-bezier(0.22,1,0.36,1)_both]',
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

const itemClass =
  'flex min-h-10 cursor-default items-center gap-2.5 rounded-md px-3 py-2 outline-none select-none transition-colors duration-100 data-[highlighted]:bg-hover-soft data-[highlighted]:text-foreground data-[disabled]:opacity-50 max-md:min-h-12';

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Menu.Label>) {
  return (
    <Menu.Label
      className={cn('px-2.5 py-1.5 text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem className={cn(itemClass, 'relative pl-8', className)} {...props}>
      <Menu.ItemIndicator className="absolute left-2.5 grid size-4 place-items-center text-primary">
        <span className="size-1.5 rounded-full bg-current" />
      </Menu.ItemIndicator>
      {children}
    </Menu.RadioItem>
  );
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="my-1 h-px bg-border" />;
}

export function DropdownMenuItem({
  className,
  danger,
  ...props
}: ComponentProps<typeof Menu.Item> & { danger?: boolean }) {
  return <Menu.Item className={cn(itemClass, danger && 'text-danger', className)} {...props} />;
}
