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
  variant?: 'center' | 'drawer';
  children: ReactNode;
  onCloseAutoFocus?: (event: Event) => void;
  className?: string;
}) {
  const drawer = variant === 'drawer';
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-foreground/40',
            // Il pannello laterale lascia intravedere la bacheca: velo più leggero da `md`.
            drawer && 'md:bg-foreground/20',
          )}
        />
        <Primitive.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            'fixed z-50 flex flex-col bg-surface shadow-md outline-none',
            drawer
              ? 'inset-0 animate-[mr-fade-in_0.12s_ease-out] md:left-auto md:w-[30rem] md:max-w-[92vw] md:animate-[mr-slide-in-right_0.18s_ease-out] md:border-l md:border-border'
              : 'top-1/2 left-1/2 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 animate-[mr-fade-in_0.12s_ease-out] rounded-lg border border-border',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <Primitive.Title className="text-base font-semibold">{title}</Primitive.Title>
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
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

/** Corpo scorrevole + piè di pagina con le azioni, per i moduli dentro un Dialog. */
export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', className)}>{children}</div>
  );
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
      {children}
    </div>
  );
}
