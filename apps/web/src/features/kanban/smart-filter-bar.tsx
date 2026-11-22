import { shiftDateFilter } from '@jobward/shared';
import { ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { useMemo, type Ref } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLabels } from '@/features/labels/api';
import { cn } from '@/lib/cn';
import { useSmartFilter } from './smart-filter-context';
import { countText, DATE_FIELD_LABELS, filterChips, type FilterChip } from './smart-filter-labels';

const chipButton =
  'grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary-soft-foreground disabled:cursor-not-allowed disabled:opacity-40 max-md:size-11 [&_svg]:size-4';

/** Pulsante «Filtri» dell'intestazione: nessuna barra permanente, solo un controllo con il contatore. */
export function SmartFilterButton({
  buttonRef,
  expanded,
  onClick,
}: {
  buttonRef?: Ref<HTMLButtonElement>;
  expanded: boolean;
  onClick: () => void;
}) {
  const { activeCount } = useSmartFilter();
  return (
    <Button
      ref={buttonRef}
      variant="secondary"
      size="sm"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      onClick={onClick}
      className="max-md:h-11 md:h-9"
    >
      <Filter aria-hidden="true" />
      Filtri
      {activeCount > 0 ? (
        <Badge tone="primary" className="h-5 px-2">
          {activeCount}
          <span className="sr-only"> {activeCount === 1 ? 'attivo' : 'attivi'}</span>
        </Badge>
      ) : null}
    </Button>
  );
}

function Chip({ chip }: { chip: FilterChip }) {
  const { config, setConfig } = useSmartFilter();
  const remove = () => {
    const { [chip.key as keyof typeof config]: _removed, ...rest } = config;
    setConfig(rest as typeof config);
  };
  const step = (direction: -1 | 1) => {
    if (!chip.date) return;
    const next = shiftDateFilter(chip.date.filter, direction);
    if (next) setConfig({ ...config, [chip.date.key]: next });
  };
  const previous = chip.date ? shiftDateFilter(chip.date.filter, -1) : null;
  const next = chip.date ? shiftDateFilter(chip.date.filter, 1) : null;
  const dateLabel = chip.date ? DATE_FIELD_LABELS[chip.date.key] : '';
  return (
    <li className="inline-flex shrink-0 items-center rounded-full border border-border bg-surface pl-1 text-sm font-medium">
      {chip.date ? (
        <button
          type="button"
          className={chipButton}
          aria-label={`Periodo precedente (${dateLabel})`}
          disabled={previous === null}
          onClick={() => step(-1)}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
      ) : (
        <span className="w-2" aria-hidden="true" />
      )}
      <span className="px-1 py-1">{chip.text}</span>
      {chip.date ? (
        <button
          type="button"
          className={chipButton}
          aria-label={`Periodo successivo (${dateLabel})`}
          disabled={next === null}
          onClick={() => step(1)}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      ) : null}
      <button
        type="button"
        className={cn(chipButton, 'mr-0.5')}
        aria-label={`Rimuovi filtro: ${chip.text}`}
        onClick={remove}
      >
        <X aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Filtri attivi, visibili e rimovibili, con il contatore delle schede e lo stato vuoto. Compare
 * SOLO se c'è almeno un filtro: senza filtri non occupa spazio.
 */
export function SmartFilterBar() {
  const { active, config, context, visible, total, clear } = useSmartFilter();
  const labels = useLabels();
  const labelNames = useMemo(
    () => new Map((labels.data ?? []).map((l) => [l.id, l.name])),
    [labels.data],
  );
  if (!active) return null;
  const chips = filterChips(config, {
    today: context.today,
    labelName: (id) => labelNames.get(id) ?? '…',
  });
  const noResults = total > 0 && visible.length === 0;

  return (
    <section
      aria-label="Filtri attivi"
      data-testid="smart-filter-bar"
      className="mb-2 shrink-0 space-y-1.5"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p role="status" data-testid="smart-filter-count" className="text-sm font-semibold">
          {countText(visible.length, total, true)}
        </p>
        <Button variant="ghost" size="sm" className="-ml-2" onClick={clear}>
          Ripristina filtri
        </Button>
      </div>
      <ul
        aria-label="Filtri applicati"
        className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible"
      >
        {chips.map((chip) => (
          <Chip key={chip.key} chip={chip} />
        ))}
      </ul>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          La bacheca non contiene ancora schede: non c’è nulla da filtrare.
        </p>
      ) : noResults ? (
        <p className="text-sm text-muted-foreground">
          Nessuna candidatura corrisponde ai filtri attivi.{' '}
          <button type="button" className="font-semibold text-primary underline" onClick={clear}>
            Mostra tutte
          </button>
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Con i filtri attivi il riordino nella stessa colonna è disattivato: puoi spostare le schede
        tra colonne o usare «Sposta in…».
      </p>
    </section>
  );
}
