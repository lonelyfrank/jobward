import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Contenitore base con bordo discreto: la "carta" della struttura visiva. */
export function Surface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-surface shadow-sm', className)}
      {...props}
    />
  );
}
