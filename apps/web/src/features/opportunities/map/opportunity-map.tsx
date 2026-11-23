import type { Place } from '@jobward/schemas';
import { distanceKm, formatDistance } from '@jobward/shared';
import { House, MapPin, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlaces } from '@/features/places/api';
import { cn } from '@/lib/cn';
import { STAGE_LABELS } from '@/lib/labels';
import { useOpportunityMap } from '../api';
import europeMap from './europe-map.json';
import { MapCanvas } from './map-canvas';
import { distanceRows, groupByPoint, splitByLocation, summarizeByPlace } from './model';

const asset = europeMap;
const km = (value: number | null) => (value === null ? '—' : formatDistance(value));
const pointKey = (item: { latitude: number; longitude: number }) =>
  `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`;

/** Larghezza minima della vista (px) per affiancare mappa e pannello. */
const SIDE_BY_SIDE_MIN = 640;
/** Sotto questa altezza la vista non è più usabile: meglio far scorrere un po' la pagina. */
const MIN_HEIGHT = 300;

/**
 * Affiancati, mappa e pannello occupano lo spazio visibile fino al fondo dell'area principale:
 * tutta la vista sta nello schermo e scorre solo il contenuto del pannello.
 */
function useViewportFit(ref: RefObject<HTMLElement | null>) {
  const [state, setState] = useState({ wide: false, height: MIN_HEIGHT });
  const measure = () => {
    const element = ref.current;
    if (!element) return;
    const main = element.closest('main');
    const rect = element.getBoundingClientRect();
    const top = rect.top - (main?.getBoundingClientRect().top ?? 0) + (main?.scrollTop ?? 0);
    const visible = main?.clientHeight ?? window.innerHeight;
    const bottomPadding = main ? Number.parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
    const next = {
      wide: rect.width >= SIDE_BY_SIDE_MIN,
      // 8 px di margine: arrotondamenti e bordi non devono far comparire la barra di scorrimento.
      height: Math.max(MIN_HEIGHT, Math.floor(visible - top - bottomPadding - 8)),
    };
    setState((current) =>
      current.wide === next.wide && Math.abs(current.height - next.height) < 2 ? current : next,
    );
  };
  // Dopo ogni render: il contenuto sopra la vista (viste salvate, avvisi) può cambiare altezza.
  useLayoutEffect(measure);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  });
  return state;
}

function PlaceIcon({ place }: { place: Place }) {
  return place.kind === 'home' ? (
    <House aria-hidden="true" className="size-4 shrink-0 text-primary" />
  ) : (
    <MapPin aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
  );
}

/**
 * Vista Mappa delle opportunità (D-07). Usa gli STESSI filtri dell'elenco: cambiare un filtro
 * cambia le aziende sulla mappa. Le distanze sono in linea d'aria dalle posizioni del Profilo;
 * le opportunità senza coordinate restano elencate, mai collocate per deduzione.
 * Da 640 px di larghezza mappa e pannello (Distanze · Elenco · Senza coordinate) sono affiancati e
 * alti quanto lo spazio visibile. Caricata a richiesta, insieme ai confini incorporati.
 */
export default function OpportunityMap({
  query,
  detailHref,
}: {
  query: Record<string, string>;
  /** Indirizzo del dettaglio di un'opportunità (con l'eventuale scheda, es. `#dettagli`). */
  detailHref: (id: string, hash?: string) => string;
}) {
  const map = useOpportunityMap(query);
  const places = usePlaces();
  const placeList = useMemo(() => places.data ?? [], [places.data]);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [tab, setTab] = useState<string | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const unlocatedId = useId();
  const fit = useViewportFit(areaRef);

  const items = map.data?.items;
  const { located, unlocated } = useMemo(() => splitByLocation(items ?? []), [items]);
  const groups = useMemo(() => groupByPoint(located), [located]);
  const summaries = useMemo(() => summarizeByPlace(placeList, located), [placeList, located]);
  const foundIndex = placeList.findIndex((p) => p.id === referenceId);
  const referenceIndex = foundIndex >= 0 ? foundIndex : 0;
  const reference = placeList[referenceIndex] ?? null;
  const rows = useMemo(
    () => distanceRows(located, placeList, referenceIndex),
    [located, placeList, referenceIndex],
  );
  const selected = groups.find((g) => g.key === selectedKey) ?? null;
  const hasPlaces = placeList.length > 0;
  const activeTab =
    tab === 'distances' && !hasPlaces
      ? 'list'
      : (tab ?? (hasPlaces && located.length > 0 ? 'distances' : 'list'));

  if (map.isPending) {
    return (
      <div role="status" aria-label="Caricamento della mappa" className="space-y-3">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-[28rem] w-full" />
      </div>
    );
  }
  if (map.isError && !map.data) {
    return (
      <Surface className="p-6" role="alert">
        <p className="font-semibold">Non riusciamo a caricare la mappa.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          I tuoi dati sono al sicuro: riprova tra un momento.
        </p>
        <Button className="mt-4" variant="secondary" onClick={() => void map.refetch()}>
          Riprova
        </Button>
      </Surface>
    );
  }
  const data = map.data;

  return (
    <div>
      {/* Conteggi solo per i lettori di schermo: lo spazio visibile va alla mappa. */}
      <p role="status" aria-live="polite" className="sr-only">
        {map.isFetching ? 'Aggiornamento… ' : ''}
        {data.total === 0
          ? 'Nessuna opportunità con i filtri attivi.'
          : `${data.located} opportunità sulla mappa${
              data.total > data.located ? `, ${data.total - data.located} senza coordinate` : ''
            }.`}
        {data.truncated
          ? ` Mostriamo le prime ${data.items.length} su ${data.total}: restringi i filtri per vederle tutte.`
          : ''}
      </p>

      <div
        ref={areaRef}
        className={cn(
          'grid gap-3',
          // Affiancati da 640 px; più stretti, impilati: 3/5 alla mappa e 2/5 al pannello.
          fit.wide ? 'grid-cols-[minmax(0,1fr)_17rem]' : 'grid-rows-[minmax(0,3fr)_minmax(0,2fr)]',
        )}
        style={{ height: fit.height }}
      >
        <MapCanvas
          asset={asset}
          groups={groups}
          places={placeList}
          referenceIndex={referenceIndex}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          className="h-full"
        />

        <Surface
          role="region"
          aria-label="Distanze e opportunità"
          className={cn('flex min-h-0 flex-col overflow-hidden', 'h-full')}
        >
          {selected ? (
            <div
              role="region"
              aria-label="Opportunità selezionata"
              className="border-b border-border bg-primary-soft/30 p-3"
            >
              <div className="flex items-start gap-2">
                <ul className="min-w-0 flex-1 space-y-2">
                  {selected.items.map((item) => (
                    <li key={item.id} className="min-w-0">
                      <Link
                        to={detailHref(item.id)}
                        className="font-semibold break-words text-primary underline-offset-2 hover:underline"
                      >
                        {item.title}
                      </Link>
                      <p className="text-xs break-words text-muted-foreground">
                        {[item.company, item.location, item.stage ? STAGE_LABELS[item.stage] : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  aria-label="Chiudi la selezione"
                  onClick={() => setSelectedKey(null)}
                  className="grid size-8 shrink-0 place-items-center rounded-md hover:bg-hover-soft max-md:size-11"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
              {hasPlaces ? (
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {placeList.map((place) => (
                    <div key={place.id} className="flex gap-1.5">
                      <dt className="text-muted-foreground">Da {place.name}:</dt>
                      <dd className="font-semibold tabular-nums">
                        {formatDistance(distanceKm(place, selected.point))}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          ) : null}

          {places.isSuccess && !hasPlaces ? (
            <div className="border-b border-border p-3 text-sm">
              <p>
                <span className="font-semibold">Aggiungi casa nel tuo Profilo</span> per vedere
                quanto distano le opportunità, anche da altri luoghi che stai valutando.
              </p>
              <Button asChild variant="secondary" size="sm" className="mt-2">
                <Link to="/profile">Apri il Profilo</Link>
              </Button>
            </div>
          ) : null}

          <Tabs value={activeTab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList variant="pill" aria-label="Contenuto del pannello" className="mx-3 mt-2">
              {hasPlaces ? <TabsTrigger value="distances">Distanze</TabsTrigger> : null}
              <TabsTrigger value="list">Elenco ({located.length})</TabsTrigger>
            </TabsList>

            {hasPlaces ? (
              <TabsContent value="distances" className="min-h-0 flex-1 overflow-y-auto p-3">
                {located.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nessuna opportunità con coordinate: aggiungile nei Dettagli.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Su {located.length} opportunità con coordinate, in linea d’aria (non è un
                      tempo di viaggio).
                    </p>
                    <ul
                      aria-label="Riepilogo delle distanze per posizione"
                      className="mt-2 space-y-2"
                    >
                      {summaries.map(({ place, summary }) => (
                        <li
                          key={place.id}
                          aria-label={place.name}
                          className="rounded-lg border border-border p-3"
                        >
                          <p className="flex items-center gap-1.5 font-medium">
                            <PlaceIcon place={place} />
                            <span className="min-w-0 break-words">{place.name}</span>
                          </p>
                          <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
                            <div className="col-span-3 flex items-baseline gap-2">
                              <dt className="text-muted-foreground">Media</dt>
                              <dd className="text-xl font-bold tabular-nums">
                                {km(summary.averageKm)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">Mediana</dt>
                              <dd className="tabular-nums">{km(summary.medianKm)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">Più vicina</dt>
                              <dd className="tabular-nums">{km(summary.minKm)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">Più lontana</dt>
                              <dd className="tabular-nums">{km(summary.maxKm)}</dd>
                            </div>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </TabsContent>
            ) : null}

            <TabsContent value="list" className="flex min-h-0 flex-1 flex-col">
              {placeList.length > 1 ? (
                <label className="flex items-center gap-2 px-3 pt-3 text-xs text-muted-foreground">
                  <span className="shrink-0">Ordina per distanza da</span>
                  <Select
                    value={reference?.id ?? ''}
                    onChange={(e) => setReferenceId(e.target.value)}
                    className="h-9 min-w-0 flex-1 text-sm"
                  >
                    {placeList.map((place) => (
                      <option key={place.id} value={place.id}>
                        {place.name}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : null}
              {/* Un solo contenitore che scorre: elenco per distanza e, in fondo, le opportunità
                  ancora senza coordinate. */}
              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                {located.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">
                    Nessuna opportunità con coordinate.
                  </p>
                ) : (
                  <ol
                    aria-label={
                      reference
                        ? `Opportunità dalla più vicina a ${reference.name}`
                        : 'Opportunità sulla mappa'
                    }
                    className="divide-y divide-border"
                  >
                    {rows.map(({ item, km: distances }) => {
                      const key = pointKey(item);
                      const isSelected = key === selectedKey;
                      const others = placeList
                        .map((place, i) =>
                          i === referenceIndex
                            ? null
                            : `${place.name} ${formatDistance(distances[i] ?? 0)}`,
                        )
                        .filter(Boolean)
                        .join(' · ');
                      return (
                        <li
                          key={item.id}
                          className={cn(
                            '-mx-3 flex items-start gap-2 px-3 py-2',
                            isSelected && 'bg-primary-soft/40',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <Link
                              to={detailHref(item.id)}
                              className="text-sm font-medium break-words text-primary underline-offset-2 hover:underline"
                            >
                              {item.title}
                            </Link>
                            <p className="truncate text-xs text-muted-foreground">
                              {[item.company, item.location].filter(Boolean).join(' · ') || '—'}
                            </p>
                            {others ? (
                              <p className="text-xs text-muted-foreground tabular-nums">{others}</p>
                            ) : null}
                          </div>
                          {reference ? (
                            <span className="pt-0.5 text-sm font-semibold whitespace-nowrap tabular-nums">
                              {formatDistance(distances[referenceIndex] ?? 0)}
                            </span>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 max-md:size-11"
                            aria-pressed={isSelected}
                            aria-label={`Mostra ${item.title} sulla mappa`}
                            onClick={() => setSelectedKey(isSelected ? null : key)}
                          >
                            <MapPin aria-hidden="true" />
                          </Button>
                        </li>
                      );
                    })}
                  </ol>
                )}

                {unlocated.length > 0 ? (
                  <section
                    id={unlocatedId}
                    aria-labelledby={`${unlocatedId}-title`}
                    className="mt-3 scroll-mt-3 rounded-lg bg-surface-muted p-3"
                  >
                    <h3 id={`${unlocatedId}-title`} className="text-sm font-semibold">
                      Senza coordinate ({unlocated.length})
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Non le collochiamo per deduzione: aggiungi le coordinate della sede nei
                      Dettagli.
                    </p>
                    <ul className="mt-2 divide-y divide-border">
                      {unlocated.map((item) => (
                        <li key={item.id} className="py-2">
                          <p className="text-sm font-medium break-words">{item.title}</p>
                          {item.company || item.location ? (
                            <p className="text-xs break-words text-muted-foreground">
                              {[item.company, item.location].filter(Boolean).join(' · ')}
                            </p>
                          ) : null}
                          <Link
                            to={detailHref(item.id, '#dettagli')}
                            className="text-sm font-medium text-primary underline underline-offset-2"
                            aria-label={`Aggiungi le coordinate di ${item.title}`}
                          >
                            Aggiungi le coordinate
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
        </Surface>
      </div>
    </div>
  );
}
