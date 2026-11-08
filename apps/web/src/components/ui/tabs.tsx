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
        'flex shrink-0 snap-x gap-4 overflow-x-auto border-b border-border px-3 [scrollbar-width:thin] md:px-5',
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
        'relative inline-flex min-h-11 shrink-0 snap-start items-center gap-1.5 px-3 text-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors duration-150 hover:text-foreground',
        'data-[state=active]:text-primary data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary',
        className,
      )}
      {...props}
    >
      {children}
    </Primitive.Trigger>
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof Primitive.Content>) {
  // `forceMount` mantiene montato il pannello (le bozze non si perdono) ma Radix, così, NON lo
  // nasconde: lo si nasconde qui (display:none) per toglierlo dalla vista e dall'albero di
  // accessibilità. Trovato dagli E2E: senza, i lettori di schermo leggerebbero tutte le schede.
  return (
    <Primitive.Content
      forceMount
      className={cn(
        'outline-none data-[state=inactive]:hidden motion-safe:data-[state=active]:animate-[jobward-view-enter_140ms_cubic-bezier(0.2,0,0,1)]',
        className,
      )}
      {...props}
    />
  );
}
