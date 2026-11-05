import { Tabs as Primitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Schede (tab) accessibili: frecce/Home/End per spostarsi (Radix), `aria-selected`, pannelli collegati.
 * La lista scorre in orizzontale su schermi stretti (nessun taglio, nessuna pagina che scorre di lato).
 * I pannelli restano montati (`forceMount`): le bozze dei moduli non si perdono cambiando scheda.
 */
export const Tabs = Primitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof Primitive.List>) {
  return (
    <Primitive.List
      className={cn(
        'flex shrink-0 snap-x gap-1 overflow-x-auto border-b border-border px-3 [scrollbar-width:thin] md:px-5',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Trigger> & { children: ReactNode }) {
  return (
    <Primitive.Trigger
      className={cn(
        'relative inline-flex min-h-11 shrink-0 snap-start items-center gap-1.5 px-3 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground',
        'data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary',
        className,
      )}
      {...props}
    >
      {children}
    </Primitive.Trigger>
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof Primitive.Content>) {
  // `forceMount`: Radix mantiene il pannello e imposta `hidden` quando non è selezionato.
  return <Primitive.Content forceMount className={cn('outline-none', className)} {...props} />;
}
