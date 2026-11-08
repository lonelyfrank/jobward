import { useLayoutEffect, useRef } from 'react';

/** Anima solo il cambio di vista, senza rimontare contenuti o alterare il layout. */
export function useViewEnter<T extends HTMLElement>(viewKey: string) {
  const ref = useRef<T>(null);
  const previousKey = useRef(viewKey);

  useLayoutEffect(() => {
    if (previousKey.current === viewKey) return;
    previousKey.current = viewKey;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const animation = ref.current?.animate?.([{ opacity: 0.82 }, { opacity: 1 }], {
      duration: 140,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
    });
    // Un nuovo cambio interrompe subito quello precedente.
    return () => animation?.cancel();
  }, [viewKey]);

  return ref;
}
