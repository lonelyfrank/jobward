import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

type Indicator = { x: number; y: number; width: number; height: number };

/** Un solo fondino scorre fra le opzioni, mantenendo la larghezza naturale di ciascuna. */
export function SegmentedControl({
  as: Root = 'div',
  label,
  value,
  children,
}: {
  as?: 'div' | 'nav';
  label: string;
  value: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [indicator, setIndicator] = useState<Indicator | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const active = root.querySelector<HTMLElement>(
        '[aria-current="page"], [aria-pressed="true"]',
      );
      if (!active) {
        setIndicator(null);
        return;
      }
      const next = {
        x: active.offsetLeft,
        y: active.offsetTop,
        width: active.offsetWidth,
        height: active.offsetHeight,
      };
      setIndicator((previous) =>
        previous &&
        previous.x === next.x &&
        previous.y === next.y &&
        previous.width === next.width &&
        previous.height === next.height
          ? previous
          : next,
      );
    };
    measure();
    // Include cambi di viewport, dimensione del testo e caricamento dei caratteri.
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.querySelectorAll('a, button').forEach((option) => observer.observe(option));
    return () => observer.disconnect();
  }, [value]);

  return (
    <Root
      ref={(element) => {
        ref.current = element;
      }}
      role={Root === 'nav' ? undefined : 'group'}
      aria-label={label}
      className="relative isolate flex gap-1 rounded-full bg-surface-muted p-1"
    >
      {indicator ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 rounded-full bg-primary-soft shadow-sm transition-[transform,width,height] duration-180 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{
            transform: `translate3d(${indicator.x}px, ${indicator.y}px, 0)`,
            width: indicator.width,
            height: indicator.height,
          }}
        />
      ) : null}
      {children}
    </Root>
  );
}
