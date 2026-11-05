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
          'z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-56 animate-[mr-fade-in_0.12s_ease-out] overflow-y-auto rounded-lg border border-border bg-surface p-1 text-sm shadow-md',
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

const itemClass =
  'flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 outline-none select-none data-[highlighted]:bg-surface-muted data-[disabled]:opacity-50 max-md:py-3';

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
    <Menu.RadioItem className={cn(itemClass, 'pl-8 relative', className)} {...props}>
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
