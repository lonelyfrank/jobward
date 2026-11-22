import { useLayoutEffect, useRef } from 'react';

/** Anima solo il cambio di vista, senza rimontare contenuti o alterare il layout. */
export function useViewEnter<T extends HTMLElement>(viewKey: string) {
  const ref = useRef<T>(null);
  const previousKey = useRef(viewKey);

  useLayoutEffect(() => {
    if (previousKey.current === viewKey) return;
    previousKey.current = viewKey;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // Dissolvenza + risalita di 6 px: abbastanza per leggere il cambio di vista come un
    // movimento, non come un salto. Solo opacity/transform, quindi niente rilayout.
    const animation = ref.current?.animate?.(
      [
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
    // Un nuovo cambio interrompe subito quello precedente.
    return () => animation?.cancel();
  }, [viewKey]);

  return ref;
}
