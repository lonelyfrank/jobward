import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Segnaposto di caricamento discreto, nascosto agli screen reader. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-[mr-pulse_1.6s_ease-in-out_infinite] rounded-md bg-surface-muted',
        className,
      )}
      {...props}
    />
  );
}
