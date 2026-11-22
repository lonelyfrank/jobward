import type { PlacedCard } from '@jobward/schemas';
import {
  applyQuery,
  countActiveFilters,
  EMPTY_SMART_FILTER,
  localDate,
  normalizeSmartFilter,
  smartFilterToQuery,
  type SmartFilterConfig,
  type SmartFilterContext,
  type SmartQuery,
} from '@jobward/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useNotify } from '@/components/ui/notices';
import { useLabels } from '@/features/labels/api';
import { useWorkspace } from '@/features/workspace/context';
import { onCardCreated } from './card-created';
import {
  hiddenCardMessage,
  rejectedFiltersMessage,
  shouldAnnounceHiddenCard,
} from './smart-filter-notice';
import {
  describeRejectedFilterParams,
  hasNonCanonicalFilterParams,
  readSmartFilter,
  writeSmartFilter,
} from './smart-filter-url';

/**
 * Stato dei filtri del Kanban. La FONTE è l'indirizzo (`?stage=…`): sopravvive al refresh, a
 * «indietro» e a «apri una scheda e torna». Il contesto calcola UNA volta le schede visibili per
 * la barra, il pannello e il Kanban. I filtri agiscono solo sulla vista: i dati in cache non
 * vengono mai modificati.
 */
export interface SmartFilterView {
  config: SmartFilterConfig;
  /**
   * La stessa selezione nel motore di query v2 (M5-SW.3): è ciò che si valuta e ciò che Tabella,
   * viste e bacheche intelligenti condividono. L'indirizzo resta nel formato `v:1` (compatibile).
   */
  query: SmartQuery;
  context: SmartFilterContext;
  activeCount: number;
  active: boolean;
  /** Schede che soddisfano i filtri (le stesse istanze della cache, nello stesso ordine). */
  visible: readonly PlacedCard[];
  total: number;
  setConfig: (next: SmartFilterConfig, options?: { replace?: boolean }) => void;
  clear: () => void;
}

const INACTIVE: SmartFilterView = {
  config: EMPTY_SMART_FILTER,
  query: smartFilterToQuery(EMPTY_SMART_FILTER),
  context: { today: '1970-01-01', timeZone: 'UTC' },
  activeCount: 0,
  active: false,
  visible: [],
  total: 0,
  setConfig: () => undefined,
  clear: () => undefined,
};

const SmartFilterReactContext = createContext<SmartFilterView | null>(null);

/**
 * «Oggi» nel fuso del workspace (non in quello del dispositivo). Si aggiorna da solo allo scoccare
 * della mezzanotte locale, così «Oggi» e «Questa settimana» non restano indietro a pagina aperta.
 */
function useToday(timeZone: string): string {
  const [today, setToday] = useState(() => localDate(Date.now(), timeZone));
  useEffect(() => {
    const id = window.setInterval(() => setToday(localDate(Date.now(), timeZone)), 60_000);
    return () => window.clearInterval(id);
  }, [timeZone]);
  return today;
}

export function SmartFilterProvider({
  cards,
  children,
}: {
  cards: readonly PlacedCard[];
  children: ReactNode;
}) {
  const { workspace } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const { boardId } = useParams();
  const notify = useNotify();
  const timeZone = workspace.timezone;
  const today = useToday(timeZone);

  // Etichette inesistenti: si può dirlo solo con l'elenco aggiornato (non in caricamento né in
  // aggiornamento), altrimenti un'etichetta nuova verrebbe scartata per un elenco vecchio.
  const labels = useLabels();
  const labelsData = labels.data;
  const labelsFresh = labels.isSuccess && !labels.isFetching;
  const knownLabelIds = useMemo(
    () => (labelsFresh && labelsData ? new Set(labelsData.map((label) => label.id)) : undefined),
    [labelsFresh, labelsData],
  );

  const rejected = useMemo(
    () => describeRejectedFilterParams(params, { knownLabelIds }),
    [params, knownLabelIds],
  );
  const config = useMemo(() => {
    const read = readSmartFilter(params);
    if (!knownLabelIds || !read.labelIds) return read;
    return normalizeSmartFilter({
      ...read,
      labelIds: read.labelIds.filter((id) => knownLabelIds.has(id)),
    });
  }, [params, knownLabelIds]);
  const context = useMemo<SmartFilterContext>(() => ({ today, timeZone }), [today, timeZone]);
  const query = useMemo(() => smartFilterToQuery(config), [config]);
  const visible = useMemo(() => applyQuery(cards, query, context), [cards, query, context]);

  const setConfig = useCallback(
    (next: SmartFilterConfig, options: { replace?: boolean } = {}) => {
      const nextParams = writeSmartFilter(params, normalizeSmartFilter(next));
      if (nextParams.toString() === params.toString()) return;
      // Commit sincrono: le caselle controllate non devono tornare indietro in attesa della navigazione.
      setParams(nextParams, { replace: options.replace ?? false, flushSync: true });
    },
    [params, setParams],
  );
  const clear = useCallback(() => setConfig(EMPTY_SMART_FILTER), [setConfig]);

  // Indirizzo con parametri non validi o non canonici: si riscrive in forma sicura, senza una
  // nuova voce di cronologia. Gli altri parametri dell'indirizzo restano. L'utente ne è informato
  // (un solo avviso) solo se qualcosa è stato scartato davvero: ordine, duplicati e spazi sono
  // cosmetici e restano silenziosi.
  const announcedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!hasNonCanonicalFilterParams(params) && rejected.length === 0) {
      announcedFor.current = null; // indirizzo pulito: un futuro link non valido avvisa di nuovo
      return;
    }
    setParams(writeSmartFilter(params, config), { replace: true });
    const key = params.toString();
    if (rejected.length > 0 && announcedFor.current !== key) {
      announcedFor.current = key;
      notify('info', rejectedFiltersMessage(rejected));
    }
  }, [params, config, rejected, setParams, notify]);

  // Scheda appena creata nella bacheca aperta ma esclusa dai filtri attivi: viene salvata
  // comunque; si dice all'utente dove sta e si offre di mostrarla. Solo la creazione.
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });
  const restore = useCallback(() => {
    // Legge l'indirizzo al momento del clic, non quello di quando è comparso l'avviso.
    setParams(writeSmartFilter(paramsRef.current, EMPTY_SMART_FILTER), { flushSync: true });
  }, [setParams]);
  useEffect(
    () =>
      onCardCreated((card) => {
        if (!shouldAnnounceHiddenCard({ card, boardId, config, context })) return;
        notify('info', hiddenCardMessage(card.title), {
          label: 'Ripristina filtri',
          onClick: restore,
        });
      }),
    [boardId, config, context, notify, restore],
  );

  const activeCount = countActiveFilters(config);
  const value = useMemo<SmartFilterView>(
    () => ({
      config,
      query,
      context,
      activeCount,
      active: activeCount > 0,
      visible,
      total: cards.length,
      setConfig,
      clear,
    }),
    [config, query, context, activeCount, visible, cards.length, setConfig, clear],
  );
  return <SmartFilterReactContext value={value}>{children}</SmartFilterReactContext>;
}

/** Fuori dal provider i filtri sono inattivi e `visible` è vuoto: chi filtra usa `useVisibleCards`. */
export function useSmartFilter(): SmartFilterView {
  return useContext(SmartFilterReactContext) ?? INACTIVE;
}

/** Schede da mostrare: quelle filtrate se c'è un provider, altrimenti tutte quelle date. */
export function useVisibleCards(cards: readonly PlacedCard[]): readonly PlacedCard[] {
  const filter = useContext(SmartFilterReactContext);
  return filter ? filter.visible : cards;
}
