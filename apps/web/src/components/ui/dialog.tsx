import { X } from 'lucide-react';
import { Dialog as Primitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/**
 * Finestra modale. Focus trap, Esc, ripristino del focus e ARIA sono gestiti da Radix.
 *
 * - `center`: finestra al centro (moduli brevi); su telefono occupa la larghezza disponibile.
 * - `drawer`: pannello laterale destro su desktop, a schermo intero su telefono
 *   (pannello di dettaglio della scheda: la bacheca resta visibile dietro).
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  variant = 'center',
  children,
  onCloseAutoFocus,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  variant?: 'center' | 'drawer' | 'workspace' | 'search';
  children: ReactNode;
  onCloseAutoFocus?: (event: Event) => void;
  className?: string;
}) {
  const drawer = variant === 'drawer';
  const workspace = variant === 'workspace';
  const search = variant === 'search';
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-foreground/45',
            // Il pannello laterale lascia intravedere la bacheca: velo più leggero da `md`.
            drawer && 'md:bg-foreground/20',
            search && 'bg-background/55 backdrop-blur-sm',
          )}
        />
        <Primitive.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            'fixed z-50 flex flex-col bg-surface shadow-md outline-none',
            search
              ? 'top-[min(15dvh,6rem)] left-1/2 max-h-[min(75dvh,42rem)] w-[calc(100vw-1rem)] max-w-[44rem] -translate-x-1/2 rounded-xl border border-border bg-surface/95 backdrop-blur-md'
              : workspace
                ? // Modale ampia: schermo intero a telefono, centrata (max ~1000 px, 90dvh) da `md`.
                  'inset-0 h-dvh animate-[jobward-fade-in_0.12s_ease-out] md:inset-auto md:top-1/2 md:left-1/2 md:h-auto md:max-h-[90dvh] md:min-h-[min(36rem,90dvh)] md:w-[min(1000px,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:border-border'
                : drawer
                  ? 'inset-0 animate-[jobward-fade-in_0.12s_ease-out] md:left-auto md:w-[30rem] md:max-w-[92vw] md:animate-[jobward-slide-in-right_0.18s_ease-out] md:border-l md:border-border'
                  : 'top-1/2 left-1/2 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 animate-[jobward-fade-in_0.12s_ease-out] rounded-xl border border-border',
            className,
          )}
        >
          {workspace || search ? (
            // Il contenuto fornisce un'intestazione propria (titolo, stato, azioni); qui resta il nome
            // accessibile della finestra.
            <>
              <Primitive.Title className="sr-only">{title}</Primitive.Title>
              {description ? (
                <Primitive.Description className="sr-only">{description}</Primitive.Description>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-5">
                <div className="min-w-0">
                  <Primitive.Title className="text-lg font-bold">{title}</Primitive.Title>
                  {description ? (
                    <Primitive.Description className="mt-1 text-sm text-muted-foreground">
                      {description}
                    </Primitive.Description>
                  ) : null}
                </div>
                <Primitive.Close asChild>
                  <Button variant="ghost" size="icon" aria-label="Chiudi" className="-mt-1 -mr-2">
                    <X aria-hidden="true" />
                  </Button>
                </Primitive.Close>
              </div>
            </>
          )}
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

/** Corpo scorrevole + piè di pagina con le azioni, per i moduli dentro un Dialog. */
export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5', className)}>{children}</div>
  );
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
      {children}
    </div>
  );
}

/** Pulsante di chiusura per le intestazioni personalizzate (variante `workspace`). */
export function DialogCloseButton({ className }: { className?: string }) {
  return (
    <Primitive.Close asChild>
      <Button variant="ghost" size="icon" aria-label="Chiudi" className={className}>
        <X aria-hidden="true" />
      </Button>
    </Primitive.Close>
  );
}
