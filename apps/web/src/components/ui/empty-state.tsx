import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from './badge';
import { Surface } from './surface';

/**
 * Stato vuoto progettato: spiega cosa vedrà l'utente e, se la funzione non è ancora
 * disponibile, lo dichiara con la milestone prevista. Non contiene azioni finte.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  milestone,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Es. "M1": indica la milestone in cui la funzione sarà disponibile. */
  milestone?: string;
  children?: ReactNode;
}) {
  return (
    <Surface className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-primary-soft text-primary-soft-foreground">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      {milestone ? (
        <Badge tone="warning" className="mb-3">
          In arrivo · {milestone}
        </Badge>
      ) : null}
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      {children ? <div className="mt-5 w-full max-w-md">{children}</div> : null}
    </Surface>
  );
}
