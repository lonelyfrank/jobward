import type { ColorToken } from '@meet-roulette/schemas';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { COLOR_BG, COLOR_LABELS } from '@/lib/labels';

/**
 * Etichetta: il NOME è sempre testo, il colore è solo un contrassegno decorativo accanto
 * (nessuna informazione affidata al solo colore). Il nome del colore è disponibile alle
 * tecnologie assistive.
 */
export function LabelChip({
  name,
  color,
  children,
  className,
}: {
  name: string;
  color: ColorToken;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', COLOR_BG[color])} />
      <span className="truncate">{name}</span>
      <span className="sr-only"> (colore {COLOR_LABELS[color].toLowerCase()})</span>
      {children}
    </span>
  );
}
