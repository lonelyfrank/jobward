import {
  inOrEmpty,
  normalizeSmartQuery,
  SMART_QUERY_VERSION,
  type QueryNode,
  type SmartQuery,
} from './smart-query';

/**
 * Filtri «storici» dell'elenco Opportunità (M2.3: `?priority=…&stage=…&appliedFrom=…`), espressi
 * come query v2. Il contratto HTTP e gli indirizzi della Tabella non cambiano: il server converte
 * i parametri nella stessa definizione che usa ogni altra vista, così c'è un solo compilatore SQL.
 * `none` = valore non indicato (NULL), come nel contratto originale.
 */
export interface LegacyOpportunityFilters {
  priority?: readonly string[] | undefined;
  stage?: readonly string[] | undefined;
  outcome?: readonly string[] | undefined;
  workMode?: readonly string[] | undefined;
  contractType?: readonly string[] | undefined;
  labelId?: readonly string[] | undefined;
  appliedFrom?: string | undefined;
  appliedTo?: string | undefined;
}

export function legacyFiltersToQuery(filters: LegacyOpportunityFilters): SmartQuery {
  const items: QueryNode[] = [];
  // `priority` non ammette `none` come «non indicato»: `none` è una priorità vera.
  if (filters.priority) items.push({ field: 'priority', op: 'in', value: [...filters.priority] });
  if (filters.stage) items.push(inOrEmpty('stage', filters.stage, 'none'));
  if (filters.outcome) items.push(inOrEmpty('outcome', filters.outcome, 'none'));
  if (filters.workMode) items.push(inOrEmpty('workMode', filters.workMode, 'none'));
  if (filters.contractType) items.push(inOrEmpty('contractType', filters.contractType, 'none'));
  if (filters.labelId)
    items.push({ field: 'labelIds', op: 'has_any', value: [...filters.labelId] });
  if (filters.appliedFrom !== undefined || filters.appliedTo !== undefined) {
    items.push({
      field: 'applied',
      op: 'in_period',
      value: { preset: 'custom', from: filters.appliedFrom ?? null, to: filters.appliedTo ?? null },
    });
  }
  return normalizeSmartQuery({
    v: SMART_QUERY_VERSION,
    ...(items.length > 0 ? { where: { op: 'and' as const, items } } : {}),
  });
}
