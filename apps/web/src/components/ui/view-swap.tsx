import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Passaggio fluido fra due contenuti della stessa finestra (per esempio elenco → modulo):
 * il nuovo contenuto entra scorrendo di pochi pixel mentre si dissolve, e l'altezza del
 * contenitore si adegua con una transizione invece di "saltare".
 *
 * `direction` decide da che lato entra: `forward` dalla destra (si va più a fondo),
 * `back` dalla sinistra (si torna indietro). Con `prefers-reduced-motion` non c'è movimento.
 */
export function ViewSwap({
  viewKey,
  direction = 'forward',
  children,
  className,
}: {
  viewKey: string;
  direction?: 'forward' | 'back';
  children: ReactNode;
  className?: string;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [animated, setAnimated] = useState(false);

  useLayoutEffect(() => {
    const element = inner.current;
    if (!element) return;
    const measure = () => setHeight(element.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
    // Ogni vista è un nodo nuovo: l'osservatore va riagganciato a quello corrente.
  }, [viewKey]);

  // La prima misura non deve animare (la finestra si apre già della dimensione giusta).
  useLayoutEffect(() => {
    if (height === null) return;
    const frame = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(frame);
  }, [height]);

  return (
    <div
      className={cn(
        // `-m-3` + `p-3` sul contenuto: lascia spazio agli anelli di focus e alle ombre
        // (pulsante primario), che `overflow-hidden` taglierebbe sul bordo. Il margine
        // negativo annulla il padding; i clic passano sotto la fascia vuota.
        'pointer-events-none -m-3 overflow-hidden',
        animated &&
          'transition-[height] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
        className,
      )}
      style={height === null ? undefined : { height }}
    >
      <div
        // `key`: ogni vista è un nodo nuovo, quindi l'animazione di ingresso riparte da capo.
        key={viewKey}
        ref={inner}
        className="pointer-events-none p-3 animate-[jobward-swap-in_240ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none"
        style={{ '--swap-from': direction === 'forward' ? '14px' : '-14px' } as CSSProperties}
      >
        <div className="pointer-events-auto">{children}</div>
      </div>
    </div>
  );
}
