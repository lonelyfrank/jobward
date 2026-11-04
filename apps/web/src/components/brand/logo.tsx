import { cn } from '@/lib/cn';

/**
 * Marchio: una ruota a spicchi alternati. Decorativo (il nome è sempre accanto).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-7', className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <g transform="rotate(-90 16 16)" fill="none" className="stroke-primary-foreground">
        <circle cx="16" cy="16" r="9" strokeWidth="6" strokeDasharray="7.07 7.07" />
        <circle cx="16" cy="16" r="13.5" strokeWidth="1.5" />
      </g>
      <circle cx="16" cy="16" r="2.4" className="fill-primary-foreground" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5 font-semibold tracking-tight', className)}>
      <LogoMark />
      <span>Meet Roulette</span>
    </span>
  );
}
