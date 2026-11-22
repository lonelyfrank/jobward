import { Tabs as Primitive } from 'radix-ui';
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from 'react';
import { cn } from '@/lib/cn';

/**
 * Schede (tab) accessibili: frecce/Home/End per spostarsi (Radix), `aria-selected`, pannelli collegati.
 * La lista scorre in orizzontale su schermi stretti (nessun taglio, nessuna pagina che scorre di lato).
 * I pannelli restano montati (`forceMount`): le bozze dei moduli non si perdono cambiando scheda.
 */
export const Tabs = Primitive.Root;

type Variant = 'underline' | 'pill';
const VariantContext = createContext<Variant>('underline');

type Indicator = { x: number; y: number; width: number; height: number };

/** Misura la scheda attiva per far scorrere la sottolineatura invece di ridisegnarla. */
function useActiveIndicator(list: RefObject<HTMLDivElement | null>) {
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  useLayoutEffect(() => {
    const root = list.current;
    if (!root) return;
    const measure = () => {
      const active = root.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      if (!active) return setIndicator(null);
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
    // La scheda attiva cambia con `data-state`; le misure con testo, badge e viewport.
    const mutations = new MutationObserver(measure);
    mutations.observe(root, { attributes: true, attributeFilter: ['data-state'], subtree: true });
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    resize?.observe(root);
    root.querySelectorAll('[role="tab"]').forEach((tab) => resize?.observe(tab));
    return () => {
      mutations.disconnect();
      resize?.disconnect();
    };
  }, [list]);
  return indicator;
}

/**
 * `underline`: sottolineatura che scorre sotto la scheda attiva.
 * `pill`: gruppo segmentato come nel foglio di design (fondino che scorre, scheda attiva su superficie).
 */
export function TabsList({
  className,
  children,
  variant = 'underline',
  ...props
}: ComponentProps<typeof Primitive.List> & { variant?: Variant }) {
  const list = useRef<HTMLDivElement>(null);
  const indicator = useActiveIndicator(list);
  const pill = variant === 'pill';
  return (
    <VariantContext.Provider value={variant}>
      <Primitive.List
        ref={list}
        className={cn(
          'relative isolate flex shrink-0 snap-x overflow-x-auto [scrollbar-width:thin]',
          pill
            ? 'mx-4 gap-1 rounded-xl bg-surface-muted p-1 md:mx-6'
            : 'gap-4 border-b border-border px-3 md:px-5',
          className,
        )}
        {...props}
      >
        {indicator ? (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute left-0 -z-10 transition-[transform,width,height] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
              pill
                ? 'top-0 rounded-lg bg-surface shadow-sm'
                : 'bottom-0 h-0.5 rounded-full bg-primary',
            )}
            style={
              pill
                ? {
                    transform: `translate3d(${indicator.x}px, ${indicator.y}px, 0)`,
                    width: indicator.width,
                    height: indicator.height,
                  }
                : {
                    transform: `translate3d(${indicator.x}px, 0, 0)`,
                    width: indicator.width,
                  }
            }
          />
        ) : null}
        {children}
      </Primitive.List>
    </VariantContext.Provider>
  );
}

export function TabsTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Trigger> & { children: ReactNode }) {
  const pill = useContext(VariantContext) === 'pill';
  return (
    <Primitive.Trigger
      className={cn(
        'relative inline-flex min-h-11 shrink-0 snap-start items-center gap-1.5 px-3 text-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors duration-150 hover:text-foreground',
        pill
          ? 'justify-center rounded-lg data-[state=active]:text-primary-soft-foreground md:min-h-9'
          : 'data-[state=active]:text-primary',
        className,
      )}
      {...props}
    >
      {children}
    </Primitive.Trigger>
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof Primitive.Content>) {
  // `forceMount` mantiene montato il pannello (le bozze non si perdono) ma Radix, così, NON lo
  // nasconde: lo si nasconde qui (display:none) per toglierlo dalla vista e dall'albero di
  // accessibilità. Trovato dagli E2E: senza, i lettori di schermo leggerebbero tutte le schede.
  // Passando da display:none a visibile l'animazione riparte da sola a ogni cambio di scheda.
  return (
    <Primitive.Content
      forceMount
      className={cn(
        'outline-none data-[state=inactive]:hidden motion-safe:data-[state=active]:animate-[jobward-view-enter_200ms_cubic-bezier(0.22,1,0.36,1)_both]',
        className,
      )}
      {...props}
    />
  );
}
