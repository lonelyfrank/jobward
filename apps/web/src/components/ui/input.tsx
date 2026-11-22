import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

const control =
  'h-11 w-full rounded-md border border-border-strong bg-surface px-3.5 text-sm font-medium text-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring focus-visible:ring-4 focus-visible:ring-primary-soft placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 aria-[invalid=true]:border-danger ';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(control, 'pr-8', className)} {...props} />;
}
