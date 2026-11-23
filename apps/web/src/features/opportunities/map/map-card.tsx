import type { Place } from '@jobward/schemas';
import { distanceKm, formatDistance, type GeoPoint } from '@jobward/shared';
import { Building2 } from 'lucide-react';
import { STAGE_LABELS } from '@/lib/labels';
import { groupByCompany, type LocatedItem } from './model';

const MAX_COMPANIES = 3;
const MAX_OFFERS = 4;
export const MAP_CARD_WIDTH = 256;

/**
 * Scheda che compare al passaggio del mouse (o al focus) su un segnaposto: l'azienda sempre in
 * testa e sotto le sue offerte, poi sede e distanze. Con più aziende vicine, un blocco per azienda.
 * Solo visiva (`aria-hidden`): il nome accessibile del segnaposto contiene già le stesse
 * informazioni essenziali.
 */
export function MapCard({
  items,
  point,
  places,
  cluster,
  style,
}: {
  items: LocatedItem[];
  /** Punto comune (stesso luogo): abilita sede e distanze. */
  point: GeoPoint | null;
  places: Place[];
  /** Gruppo di luoghi diversi: il clic ingrandisce. */
  cluster: boolean;
  style: React.CSSProperties;
}) {
  const companies = groupByCompany(items);
  const shown = companies.slice(0, MAX_COMPANIES);
  const hiddenOffers =
    items.length - shown.reduce((sum, group) => sum + Math.min(group.items.length, MAX_OFFERS), 0);
  const locations = [...new Set(items.map((i) => i.location).filter(Boolean))];

  return (
    <div
      aria-hidden="true"
      data-testid="map-card"
      className="pointer-events-none absolute z-40 rounded-xl border border-border bg-surface p-3 text-sm shadow-lg motion-safe:animate-[jobward-view-enter_160ms_cubic-bezier(0.22,1,0.36,1)_both]"
      style={{ width: MAP_CARD_WIDTH, ...style }}
    >
      <div className="space-y-2.5">
        {shown.map((group) => (
          <div key={group.company ?? '—'} className="min-w-0">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <Building2 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{group.company ?? 'Azienda non indicata'}</span>
              {group.items.length > 1 ? (
                <span className="ml-auto shrink-0 rounded-full bg-primary-soft px-1.5 text-[11px] font-semibold text-primary-soft-foreground">
                  {group.items.length}
                </span>
              ) : null}
            </p>
            <ul className="mt-1 space-y-0.5 border-l-2 border-primary/30 pl-2.5">
              {group.items.slice(0, MAX_OFFERS).map((item) => (
                <li key={item.id} className="flex min-w-0 items-baseline gap-1.5">
                  <span className="truncate">{item.title}</span>
                  {item.stage ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      · {STAGE_LABELS[item.stage]}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {hiddenOffers > 0 ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          e {hiddenOffers} {hiddenOffers === 1 ? 'altra' : 'altre'}
        </p>
      ) : null}
      {point && locations.length === 1 ? (
        <p className="mt-2 truncate text-xs text-muted-foreground">{locations[0]}</p>
      ) : null}
      {point && places.length > 0 ? (
        <p className="mt-1 text-xs font-medium tabular-nums">
          {places
            .map((place) => `${formatDistance(distanceKm(place, point))} da ${place.name}`)
            .join(' · ')}
        </p>
      ) : null}
      <p className="mt-2 border-t border-border pt-1.5 text-[11px] text-muted-foreground">
        {cluster ? 'Clic per ingrandire la zona' : 'Clic per selezionare e vedere le distanze'}
      </p>
    </div>
  );
}
