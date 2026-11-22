import { Dialog } from 'radix-ui';
import type { ReactNode, RefObject } from 'react';

/**
 * Pannello laterale modale (navigazione mobile). Focus trap, Esc e aria gestiti da Radix.
 *
 * Radix riporta il focus alla chiusura solo a un `Dialog.Trigger`; qui il pulsante di apertura
 * è esterno (nell’header della vista), quindi il suo ref viene passato in `returnFocusRef`.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  returnFocusRef,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim data-[state=closed]:animate-[jobward-overlay-out_160ms_ease-in_both] data-[state=open]:animate-[jobward-overlay-in_200ms_ease-out_both] md:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            if (!returnFocusRef?.current) return;
            event.preventDefault();
            returnFocusRef.current.focus();
          }}
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] data-[state=closed]:animate-[jobward-slide-out-left_180ms_ease-in_both] data-[state=open]:animate-[jobward-slide-in-left_280ms_cubic-bezier(0.22,1,0.36,1)_both] flex-col border-r border-border bg-sidebar shadow-md md:hidden"
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
