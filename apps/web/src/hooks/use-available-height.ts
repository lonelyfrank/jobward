import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Altezza disponibile per un elemento, dal suo bordo superiore al fondo visibile dell'area
 * principale (`<main>`, meno il suo margine inferiore e `reserve` px per ciò che sta sotto).
 * Serve alle viste che devono stare in una sola schermata senza far scorrere la pagina.
 * Si aggiorna dopo ogni render (il contenuto sopra può cambiare altezza) e al ridimensionamento.
 */
export function useAvailableHeight(ref: RefObject<HTMLElement | null>, reserve = 0): number {
  const [height, setHeight] = useState(0);
  const measure = () => {
    const element = ref.current;
    if (!element) return;
    const main = element.closest('main');
    const top =
      element.getBoundingClientRect().top -
      (main?.getBoundingClientRect().top ?? 0) +
      (main?.scrollTop ?? 0);
    const visible = main?.clientHeight ?? window.innerHeight;
    const bottom = main ? Number.parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
    const next = Math.max(0, Math.floor(visible - top - bottom - reserve));
    setHeight((current) => (Math.abs(current - next) < 2 ? current : next));
  };
  useLayoutEffect(measure);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  });
  return height;
}
