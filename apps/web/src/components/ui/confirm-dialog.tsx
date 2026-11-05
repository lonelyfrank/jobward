import { AlertDialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Conferma di un'azione distruttiva. A differenza di un Dialog, il focus iniziale va su
 * "Annulla" (l'opzione sicura) e Esc/click esterno non confermano mai.
 * La chiusura è sempre decisa dal chiamante: durante la richiesta il pulsante resta in attesa.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Annulla',
  pending = false,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-foreground/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-[70] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 animate-[jobward-fade-in_0.12s_ease-out] rounded-lg border border-border bg-surface p-5 shadow-md">
          <AlertDialog.Title className="text-base font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="mt-2 space-y-2 text-sm text-muted-foreground">{description}</div>
          </AlertDialog.Description>
          {error ? (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={pending}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            {/* Non è un AlertDialog.Action: quello chiuderebbe il dialogo prima dell'esito. */}
            <Button variant="danger" disabled={pending} onClick={onConfirm}>
              {pending ? 'Attendi…' : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
