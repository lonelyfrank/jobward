import type { Card } from '@jobward/schemas';
import {
  compileSmartFilter,
  isSmartFilterActive,
  SMART_FILTER_LIMITS,
  type SmartFilterConfig,
  type SmartFilterContext,
} from '@jobward/shared';
import { SMART_FILTER_PARAMS, type RejectedFilterParam } from './smart-filter-url';

/** Testi e decisioni degli avvisi dei filtri. Funzioni pure, senza React. */

/**
 * Una scheda appena creata va segnalata solo se: la bacheca aperta è la sua, i filtri sono attivi e
 * la scheda non li soddisfa. Il confronto usa lo stesso predicato che disegna il Kanban, con lo
 * stesso «oggi» e fuso orario: la segnalazione e ciò che si vede non possono divergere.
 */
export function shouldAnnounceHiddenCard({
  card,
  boardId,
  config,
  context,
}: {
  card: Card;
  boardId: string | undefined;
  config: SmartFilterConfig;
  context: SmartFilterContext;
}): boolean {
  if (!boardId || card.boardId !== boardId) return false;
  if (!isSmartFilterActive(config)) return false;
  return !compileSmartFilter(config, context)(card);
}

const TITLE_MAX = 40;

export function hiddenCardMessage(title: string): string {
  const trimmed = title.trim();
  const shown = trimmed.length > TITLE_MAX ? `${trimmed.slice(0, TITLE_MAX - 1)}…` : trimmed;
  return `Scheda “${shown}” creata, ma non è visibile con i filtri attivi.`;
}

const PARAM_NAMES: Record<string, string> = {
  [SMART_FILTER_PARAMS.created]: 'Creazione',
  [SMART_FILTER_PARAMS.applied]: 'Invio',
  [SMART_FILTER_PARAMS.updated]: 'Aggiornamento',
  [SMART_FILTER_PARAMS.stage]: 'Fase',
  [SMART_FILTER_PARAMS.company]: 'Azienda',
  [SMART_FILTER_PARAMS.priority]: 'Priorità',
  [SMART_FILTER_PARAMS.workMode]: 'Modalità',
  [SMART_FILTER_PARAMS.contractType]: 'Contratto',
  [SMART_FILTER_PARAMS.labelIds]: 'Etichetta',
  [SMART_FILTER_PARAMS.location]: 'Località',
};

const VALUE_MAX = 24;
const ITEMS_MAX = 3;

function rejectedItem({ param, value, reason }: RejectedFilterParam): string {
  const name = PARAM_NAMES[param] ?? param;
  if (reason === 'unknown') return `${name}: non esiste più`;
  if (reason === 'truncated') {
    const limit =
      param === SMART_FILTER_PARAMS.labelIds
        ? SMART_FILTER_LIMITS.maxLabels
        : param === SMART_FILTER_PARAMS.company
          ? SMART_FILTER_LIMITS.maxCompanies
          : SMART_FILTER_LIMITS.textMax;
    return `${name}: oltre il limite di ${limit}, il resto è ignorato`;
  }
  const shown = value.length > VALUE_MAX ? `${value.slice(0, VALUE_MAX - 1)}…` : value;
  return `${name}: “${shown}” non valido`;
}

/** Un solo messaggio per tutta la normalizzazione, con al massimo tre voci. */
export function rejectedFiltersMessage(rejected: readonly RejectedFilterParam[]): string {
  const items = rejected.slice(0, ITEMS_MAX).map(rejectedItem);
  const more = rejected.length - items.length;
  if (more > 0) items.push(`altri ${more}`);
  return `Alcuni filtri del link non erano validi e sono stati ignorati. ${items.join(' · ')}.`;
}
