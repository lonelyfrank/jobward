import { Tooltip as Tip } from 'radix-ui';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export const TooltipProvider = Tip.Provider;

/** Istante dell'ultimo tasto di navigazione (Tab, frecce, Home/Fine): distingue il focus "guidato". */
let lastNavigationKeyAt = -Infinity;
if (typeof document !== 'undefined') {
  document.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key === 'Tab' ||
        event.key.startsWith('Arrow') ||
        event.key === 'Home' ||
        event.key === 'End'
      ) {
        lastNavigationKeyAt = performance.now();
      }
    },
    true,
  );
}

/** Vero se il puntatore è sopra l'elemento oppure se ha il focus da tastiera. */
function isEngaged(element: HTMLElement | null) {
  if (!element?.isConnected) return false;
  try {
    return element.matches(':hover') || element.matches(':focus-visible');
  } catch {
    return false;
  }
}

/**
 * Può aprirsi? Con il mouse sopra, sì. Per il focus, solo se ci è arrivato chi naviga da tastiera:
 * un focus riportato da codice (chiusura di un dialogo o di un menu con Esc/Invio) non deve
 * far comparire un suggerimento che poi nessun evento del mouse chiuderebbe.
 */
function canOpen(element: HTMLElement | null) {
  if (!element?.isConnected) return false;
  try {
    return (
      element.matches(':hover') ||
      (element.matches(':focus-visible') && performance.now() - lastNavigationKeyAt < 300)
    );
  } catch {
    return false;
  }
}

/**
 * Suggerimento visibile al passaggio del mouse e al focus da tastiera. Il contenuto non è l'unico
 * modo di capire l'azione.
 *
 * Non resta mai "congelato": Radix lo apre anche quando il focus torna da solo sul controllo
 * (chiusura di un dialogo o di un menu aperti col mouse) e in quel caso nessun evento lo
 * chiuderebbe. Qui un suggerimento si apre solo se il controllo è davvero sotto il mouse o ha il
 * focus da tastiera, e finché è aperto viene riverificato a ogni movimento, scroll, perdita di
 * focus della finestra e cambio di visibilità; se non c'è più motivo di mostrarlo si chiude.
 */
export function Tooltip({
  content,
  children,
  disabled = false,
  side = 'right',
}: {
  content: string;
  children: ReactNode;
  disabled?: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const verify = () => {
      if (!isEngaged(trigger.current)) setOpen(false);
    };
    // Con il mouse in movimento conta solo l'hover: un suggerimento rimasto aperto per il focus
    // (per esempio dopo aver chiuso un dialogo con Esc) sparisce appena si usa il puntatore altrove.
    const verifyPointer = () => {
      if (!trigger.current?.matches(':hover')) setOpen(false);
    };
    document.addEventListener('pointermove', verifyPointer, true);
    document.addEventListener('pointerdown', verifyPointer, true);
    document.addEventListener('scroll', verify, true);
    document.addEventListener('keydown', verify, true);
    window.addEventListener('blur', close);
    document.addEventListener('visibilitychange', close);
    // Rete di sicurezza: anche senza eventi (controllo nascosto o rimosso sotto il mouse).
    const interval = window.setInterval(verify, 400);
    return () => {
      document.removeEventListener('pointermove', verifyPointer, true);
      document.removeEventListener('pointerdown', verifyPointer, true);
      document.removeEventListener('scroll', verify, true);
      document.removeEventListener('keydown', verify, true);
      window.removeEventListener('blur', close);
      document.removeEventListener('visibilitychange', close);
      window.clearInterval(interval);
    };
  }, [open, close]);

  return (
    <Tip.Root
      delayDuration={250}
      // Il contenuto non è interattivo: uscendo dal controllo il suggerimento si chiude subito.
      disableHoverableContent
      open={open && !disabled}
      onOpenChange={(next) => {
        if (!next) return setOpen(false);
        // Apertura legittima solo con mouse sopra o focus raggiunto navigando da tastiera.
        setOpen(!disabled && canOpen(trigger.current));
      }}
    >
      <Tip.Trigger asChild ref={trigger}>
        {children}
      </Tip.Trigger>
      <Tip.Portal>
        <Tip.Content
          side={side}
          sideOffset={8}
          className="pointer-events-none z-50 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md data-[state=closed]:animate-[jobward-pop-out_80ms_ease-in_both] data-[state=delayed-open]:animate-[jobward-pop-in_140ms_cubic-bezier(0.22,1,0.36,1)_both] data-[state=instant-open]:animate-[jobward-pop-in_100ms_ease-out_both]"
        >
          {content}
        </Tip.Content>
      </Tip.Portal>
    </Tip.Root>
  );
}
