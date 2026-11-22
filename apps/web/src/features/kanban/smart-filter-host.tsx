import type { Card } from '@jobward/schemas';
import { companyOptions } from '@jobward/shared';
import { useMemo } from 'react';
import { useLabels } from '@/features/labels/api';
import { useSmartFilter } from './smart-filter-context';
import { SmartFilterPanel } from './smart-filter-panel';

/** Collega il pannello allo stato dei filtri (indirizzo) e ai dati della bacheca. */
export function SmartFilterPanelHost({
  open,
  onOpenChange,
  cards,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: readonly Card[];
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const filter = useSmartFilter();
  const labels = useLabels();
  const companies = useMemo(() => companyOptions(cards), [cards]);
  return (
    <SmartFilterPanel
      open={open}
      onOpenChange={onOpenChange}
      config={filter.config}
      onChange={filter.setConfig}
      onClear={filter.clear}
      context={filter.context}
      companies={companies}
      labels={labels.data ?? []}
      visible={filter.visible.length}
      total={filter.total}
      {...(onCloseAutoFocus ? { onCloseAutoFocus } : {})}
    />
  );
}
