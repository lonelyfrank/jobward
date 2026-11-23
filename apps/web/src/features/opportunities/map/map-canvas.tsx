import type { Place } from '@jobward/schemas';
import { distanceKm, formatDistance } from '@jobward/shared';
import { House, Layers, LocateFixed, MapPin, Minus, Plus } from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { cn } from '@/lib/cn';
import {
  clampView,
  clusterOnScreen,
  fitView,
  MAX_ZOOM,
  minZoom,
  viewBox,
  zoomAt,
  type MapFrame,
  type MapGroup,
  type MapView,
} from './model';
import { readStorage, writeStorage } from '@/lib/storage';
import { MAP_CARD_WIDTH, MapCard } from './map-card';
import {
  osmTileUrl,
  projectPoint,
  TILE_MIN_ZOOM,
  tileZoom,
  visibleTiles,
  type MapAsset,
} from './projection';

/** Stradario OpenStreetMap acceso o spento: preferenza di questo dispositivo (acceso se mai scelto). */
const STREETS_STORAGE_KEY = 'jobward.map.streets.v1';

const controlClass =
  'grid size-9 place-items-center rounded-md border border-border bg-surface text-foreground shadow-sm hover:bg-hover-soft disabled:opacity-50 max-md:size-11';

/**
 * Mappa SVG con i confini incorporati (D-07). I segnaposto sono PULSANTI HTML sovrapposti in
 * percentuale: dimensione costante a ogni zoom, focus da tastiera e nomi accessibili. L'elenco
 * per distanza accanto alla mappa è l'equivalente testuale completo.
 */
export function MapCanvas({
  asset,
  groups,
  places,
  referenceIndex,
  selectedKey,
  onSelect,
  className,
}: {
  asset: MapAsset;
  groups: MapGroup[];
  places: Place[];
  referenceIndex: number;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  /** Altezza del riquadro (decisa dalla pagina): la mappa si adatta a qualunque proporzione. */
  className?: string;
}) {
  const { width: W, height: H, projection } = asset;
  const helpId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const projectedGroups = useMemo(
    () => groups.map((group) => ({ group, ...projectPoint(projection, group.point) })),
    [groups, projection],
  );
  const projectedPlaces = useMemo(
    () => places.map((place) => ({ place, ...projectPoint(projection, place) })),
    [places, projection],
  );
  const allPoints = useMemo(
    () => [...projectedGroups, ...projectedPlaces].map(({ x, y }) => ({ x, y })),
    [projectedGroups, projectedPlaces],
  );
  // Dimensioni reali del riquadro: proporzioni della vista e raggruppamento dei segnaposto in pixel.
  const [pixels, setPixels] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setPixels((current) =>
        current.w === rect.width && current.h === rect.height
          ? current
          : { w: rect.width, h: rect.height },
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const aspect = pixels.w > 0 && pixels.h > 0 ? pixels.h / pixels.w : H / W;
  const frame = useMemo<MapFrame>(() => ({ width: W, height: H, aspect }), [W, H, aspect]);
  // Il gestore della rotellina (registrato una volta) legge sempre il riquadro corrente.
  const frameRef = useRef(frame);
  useLayoutEffect(() => {
    frameRef.current = frame;
  });

  // Nuovi punti (filtri cambiati, posizione aggiunta) → nuova inquadratura su tutti i punti.
  // Se cambia solo la forma del riquadro, si reinquadra finché l'utente non ha spostato la mappa.
  const signature = useMemo(
    () => [...groups.map((g) => g.key), ...places.map((p) => p.id)].join('|'),
    [groups, places],
  );
  const fitKey = `${signature}|${aspect.toFixed(2)}`;
  const [view, setView] = useState<MapView>(() => fitView(allPoints, frame));
  const [moved, setMoved] = useState(false);
  const [fitted, setFitted] = useState({ key: fitKey, signature });
  if (fitted.key !== fitKey) {
    const newPoints = fitted.signature !== signature;
    setFitted({ key: fitKey, signature });
    if (newPoints || !moved) {
      setView(fitView(allPoints, frame));
      setMoved(false);
    } else {
      setView((current) => clampView(current, frame));
    }
  }

  const box = viewBox(view, frame);

  // Stradario OpenStreetMap (ADR-0019): tile del livello adatto alla scala più, sotto, un livello
  // più grossolano già in cache, così durante lo zoom non compaiono buchi. Spento = nessuna richiesta.
  const [streets, setStreets] = useState(() => readStorage(STREETS_STORAGE_KEY) !== 'off');
  const toggleStreets = () => {
    setStreets(!streets);
    writeStorage(STREETS_STORAGE_KEY, streets ? 'off' : 'on');
  };
  const tiles = useMemo(() => {
    if (!streets || pixels.w <= 0) return [];
    const z = tileZoom(projection, box.w / pixels.w);
    const coarse = Math.max(TILE_MIN_ZOOM, z - 3);
    return [
      ...(coarse < z ? visibleTiles(projection, box, coarse) : []),
      ...visibleTiles(projection, box, z),
    ];
  }, [streets, pixels.w, projection, box.x, box.y, box.w, box.h]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Posizione nel riquadro, in frazioni (0–1). */
  const toFraction = (x: number, y: number) => ({
    fx: (x - box.x) / box.w,
    fy: (y - box.y) / box.h,
  });
  const visible = ({ fx, fy }: { fx: number; fy: number }) =>
    fx > -0.05 && fx < 1.05 && fy > -0.05 && fy < 1.05;

  const zoom = (factor: number, fx = 0.5, fy = 0.5) => {
    setMoved(true);
    setView((current) => zoomAt(current, factor, fx, fy, frame));
  };
  const pan = (dxFraction: number, dyFraction: number) => {
    setMoved(true);
    setView((current) => {
      const { w, h } = viewBox(current, frame);
      return clampView(
        { ...current, cx: current.cx + dxFraction * w, cy: current.cy + dyFraction * h },
        frame,
      );
    });
  };
  const fit = () => {
    setMoved(false);
    setView(fitView(allPoints, frame));
  };

  // Ctrl/⌘ + rotellina (e il pizzico del trackpad) zoomano; la rotellina da sola scorre la pagina.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.0025);
      setMoved(true);
      setView((current) =>
        zoomAt(
          current,
          factor,
          (event.clientX - rect.left) / rect.width,
          (event.clientY - rect.top) / rect.height,
          frameRef.current,
        ),
      );
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  // Trascinamento per spostarsi (mouse, penna e dito).
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    drag.current = { x: event.clientX, y: event.clientY, moved: false };
    setHover(null);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) start.moved = true;
    drag.current = { x: event.clientX, y: event.clientY, moved: start.moved };
    if (rect.width > 0 && rect.height > 0) pan(-dx / rect.width, -dy / rect.height);
  };
  const onPointerUp = () => {
    // Un clic sul fondo (senza trascinare) chiude la selezione.
    if (drag.current && !drag.current.moved) onSelect(null);
    drag.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const step = 0.15;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => pan(-step, 0),
      ArrowRight: () => pan(step, 0),
      ArrowUp: () => pan(0, -step),
      ArrowDown: () => pan(0, step),
      '+': () => zoom(1.6),
      '=': () => zoom(1.6),
      '-': () => zoom(1 / 1.6),
      '0': fit,
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  const selected = projectedGroups.find((p) => p.group.key === selectedKey) ?? null;
  // Segnaposto visibili, raggruppati se a meno di 22 px (la selezione resta sempre distinta).
  const onScreen = projectedGroups
    .map((p) => ({ ...p, ...toFraction(p.x, p.y) }))
    .filter(visible)
    .map((p) => ({ ...p, sx: p.fx * pixels.w, sy: p.fy * pixels.h }));
  const clusters =
    pixels.w > 0
      ? [
          ...clusterOnScreen(
            onScreen.filter((p) => p.group.key !== selectedKey),
            22,
          ),
          ...onScreen.filter((p) => p.group.key === selectedKey).map((p) => [p]),
        ]
      : onScreen.map((p) => [p]);
  const reference = places[referenceIndex];

  // Scheda al passaggio del mouse o al focus di un segnaposto (non durante il trascinamento).
  const [hover, setHover] = useState<{ key: string } | null>(null);
  const hovered = hover
    ? clusters.find((members) => members.map((m) => m.group.key).join('|') === hover.key)
    : undefined;

  // Posizioni dell'utente sullo schermo: i segnaposto che le coprirebbero si spostano di lato.
  const placePixels = projectedPlaces
    .map(({ x, y }) => toFraction(x, y))
    .filter(visible)
    .map(({ fx, fy }) => ({ sx: fx * pixels.w, sy: fy * pixels.h }));
  const NUDGE = 18;
  const nudge = (sx: number, sy: number) =>
    placePixels.some((p) => Math.hypot(p.sx - sx, p.sy - sy) < NUDGE)
      ? { dx: NUDGE, dy: -NUDGE }
      : { dx: 0, dy: 0 };
  const markerAt = (members: typeof onScreen) => {
    const fx = members.reduce((sum, m) => sum + m.fx, 0) / members.length;
    const fy = members.reduce((sum, m) => sum + m.fy, 0) / members.length;
    const { dx, dy } = nudge(fx * pixels.w, fy * pixels.h);
    return { fx, fy, dx, dy };
  };
  const cardStyle = (members: typeof onScreen): React.CSSProperties => {
    const { fx, fy, dx, dy } = markerAt(members);
    // Riquadro non ancora misurato: posizione in percentuale accanto al segnaposto.
    if (pixels.w <= 0) return { left: `${fx * 100}%`, top: `calc(${fy * 100}% + 18px)` };
    const x = fx * pixels.w + dx;
    const y = fy * pixels.h + dy;
    const left = Math.min(Math.max(8, x - MAP_CARD_WIDTH / 2), pixels.w - MAP_CARD_WIDTH - 8);
    // Sopra il segnaposto se c'è spazio, altrimenti sotto.
    return y > pixels.h * 0.45 ? { left, bottom: pixels.h - y + 18 } : { left, top: y + 18 };
  };

  return (
    <>
      {/* Widget mappa (role="application"): riceve il focus per spostarsi e zoomare da tastiera.
          jsx-a11y non considera interattivo questo ruolo, ma è quello previsto da WAI-ARIA. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={containerRef}
        role="application"
        aria-roledescription="mappa"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        aria-label="Mappa delle opportunità"
        aria-describedby={helpId}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        className={cn(
          'relative w-full cursor-grab touch-none overflow-hidden rounded-xl border border-border bg-info-soft outline-none select-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
          className,
        )}
        style={className ? undefined : { aspectRatio: `${W} / ${H}` }}
        data-testid="opportunity-map"
      >
        {/* Confini incorporati: sempre disponibili (senza rete, o con lo stradario spento). */}
        <svg
          viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          aria-hidden="true"
        >
          <g className="fill-surface stroke-border-strong">
            {asset.countries.map((country, i) => (
              <path
                key={`${country.id}-${i}`}
                d={country.d}
                strokeWidth={0.8}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            ))}
          </g>
        </svg>
        {tiles.length > 0 ? (
          <svg
            viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
            preserveAspectRatio="none"
            className="map-tiles absolute inset-0 size-full"
            aria-hidden="true"
            data-testid="map-tiles"
          >
            {tiles.map((tile) => (
              <image
                key={`${tile.z}/${tile.x}/${tile.y}`}
                href={osmTileUrl(tile)}
                x={tile.left}
                y={tile.top}
                // Un soffio di sovrapposizione evita le righe sottili tra un tile e l'altro.
                width={tile.size * 1.004}
                height={tile.size * 1.004}
                preserveAspectRatio="none"
              />
            ))}
          </svg>
        ) : null}
        <svg
          viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full"
          aria-hidden="true"
        >
          {selected
            ? projectedPlaces.map(({ place, x, y }) => (
                <line
                  key={place.id}
                  x1={x}
                  y1={y}
                  x2={selected.x}
                  y2={selected.y}
                  className="stroke-primary"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  vectorEffect="non-scaling-stroke"
                />
              ))
            : null}
        </svg>

        {/* Distanze lungo le linee della selezione. */}
        {selected
          ? projectedPlaces.map(({ place, x, y }) => {
              const mid = toFraction((x + selected.x) / 2, (y + selected.y) / 2);
              if (!visible(mid)) return null;
              return (
                <span
                  key={place.id}
                  aria-hidden="true"
                  className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-surface px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap tabular-nums shadow-sm"
                  style={{ left: `${mid.fx * 100}%`, top: `${mid.fy * 100}%` }}
                >
                  {formatDistance(distanceKm(place, selected.group.point))}
                </span>
              );
            })
          : null}

        {/* Posizioni dell'utente: sopra i segnaposto (sempre visibili) ma trasparenti ai clic;
            etichetta sotto l'icona. Nel pannello le stesse informazioni sono testo. */}
        {projectedPlaces.map(({ place, x, y }) => {
          const at = toFraction(x, y);
          if (!visible(at)) return null;
          return (
            <span
              key={place.id}
              aria-hidden="true"
              className="pointer-events-none absolute z-30 flex -translate-x-1/2 -translate-y-3.5 flex-col items-center gap-0.5"
              style={{ left: `${at.fx * 100}%`, top: `${at.fy * 100}%` }}
            >
              <span
                className={cn(
                  'grid size-7 place-items-center rounded-full border-2 border-surface shadow',
                  place.kind === 'home'
                    ? 'bg-foreground text-background'
                    : 'bg-teal-soft text-teal-soft-foreground',
                )}
              >
                {place.kind === 'home' ? (
                  <House className="size-4" />
                ) : (
                  <MapPin className="size-4" />
                )}
              </span>
              <span className="rounded bg-surface/90 px-1 text-[11px] leading-4 font-semibold whitespace-nowrap shadow-sm">
                {place.name}
              </span>
            </span>
          );
        })}

        {/* Opportunità: pulsanti. Un numero indica più opportunità nello stesso luogo o, a questa
            scala, troppo vicine per essere distinte: il pulsante allora ingrandisce su di loro. */}
        {clusters.map((members) => {
          const at = markerAt(members);
          const items = members.flatMap((m) => m.group.items);
          const key = members.map((m) => m.group.key).join('|');
          const style = {
            left: `calc(${at.fx * 100}% + ${at.dx}px)`,
            top: `calc(${at.fy * 100}% + ${at.dy}px)`,
          };
          const hoverProps = {
            onMouseEnter: () => !drag.current && setHover({ key }),
            onMouseLeave: () => setHover(null),
            onFocus: () => setHover({ key }),
            onBlur: () => setHover(null),
          };
          if (members.length > 1) {
            const label = `${items.length} opportunità vicine: ${items
              .map((i) => i.title)
              .join(', ')}. Ingrandisci`;
            return (
              <button
                key={key}
                type="button"
                aria-label={label}
                {...hoverProps}
                onClick={() => {
                  setHover(null);
                  const target = fitView(members, frame);
                  setMoved(true);
                  setView(clampView({ ...target, k: Math.max(target.k, view.k * 2) }, frame));
                }}
                className="absolute z-10 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-surface bg-primary text-xs font-bold text-primary-foreground shadow ring-4 ring-primary/25 transition-transform hover:scale-110 focus-visible:ring-ring focus-visible:outline-none"
                style={style}
              >
                {items.length}
              </button>
            );
          }
          const { group } = members[0]!;
          const isSelected = group.key === selectedKey;
          const first = group.items[0]!;
          const name =
            group.items.length === 1
              ? [first.title, first.company].filter(Boolean).join(', ')
              : `${group.items.length} opportunità: ${group.items.map((i) => i.title).join(', ')}`;
          const distance = reference
            ? `, ${formatDistance(distanceKm(reference, group.point))} da ${reference.name}`
            : '';
          return (
            <button
              key={group.key}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${name}${distance}`}
              {...hoverProps}
              onClick={() => onSelect(isSelected ? null : group.key)}
              className={cn(
                'absolute z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-surface bg-primary text-[11px] font-bold text-primary-foreground shadow transition-transform hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-md:min-h-6 max-md:min-w-6',
                group.items.length > 1 ? 'size-6' : 'size-4',
                isSelected && 'z-20 size-7 ring-4 ring-primary/30',
              )}
              style={style}
            >
              {group.items.length > 1 ? group.items.length : null}
            </button>
          );
        })}

        {hovered ? (
          <MapCard
            items={hovered.flatMap((m) => m.group.items)}
            point={hovered.length === 1 ? hovered[0]!.group.point : null}
            places={places}
            cluster={hovered.length > 1}
            style={cardStyle(hovered)}
          />
        ) : null}

        {/* In colonna; sui telefoni (mappa bassa) in riga, per non coprirla tutta. */}
        <div className="absolute top-2 right-2 z-40 flex flex-col gap-1.5 max-md:flex-row">
          <button
            type="button"
            className={controlClass}
            aria-label="Ingrandisci"
            disabled={view.k >= MAX_ZOOM}
            onClick={() => zoom(1.6)}
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            className={controlClass}
            aria-label="Riduci"
            disabled={view.k <= minZoom(frame) + 1e-9}
            onClick={() => zoom(1 / 1.6)}
          >
            <Minus aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            className={controlClass}
            aria-label="Inquadra tutti i punti"
            onClick={fit}
          >
            <LocateFixed aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            className={cn(controlClass, streets && 'bg-primary-soft text-primary-soft-foreground')}
            aria-pressed={streets}
            aria-label="Stradario OpenStreetMap"
            title={
              streets
                ? 'Stradario OpenStreetMap attivo: la zona visibile viene chiesta a openstreetmap.org'
                : 'Stradario spento: solo confini, nessuna richiesta esterna'
            }
            onClick={toggleStreets}
          >
            <Layers aria-hidden="true" className="size-4" />
          </button>
        </div>
        <p
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1 left-2 z-40 rounded bg-surface/80 px-1.5 text-[11px] text-muted-foreground max-md:hidden"
        >
          Trascina per spostarti · Ctrl/⌘ + rotellina per lo zoom
        </p>
        {streets ? (
          <p className="absolute right-0 bottom-0 z-40 rounded-tl bg-surface/85 px-1.5 text-[11px] text-muted-foreground">
            ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              contributori di OpenStreetMap
            </a>
          </p>
        ) : (
          <p className="pointer-events-none absolute right-2 bottom-1 z-40 text-[10px] text-muted-foreground">
            Confini: Natural Earth
          </p>
        )}
        <p id={helpId} className="sr-only">
          Trascina per spostarti; Ctrl (⌘ su Mac) + rotellina o i pulsanti per lo zoom. Con la mappa
          selezionata: frecce per spostarti, + e − per lo zoom, 0 per inquadrare tutto. Distanze in
          linea d’aria.
        </p>
      </div>
    </>
  );
}
