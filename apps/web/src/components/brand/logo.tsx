import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/cn';

/** Ritaglio di visualizzazione del simbolo originale, senza ridisegno né modifica del PNG. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="60 75 170 170"
      role="img"
      aria-label={BRAND.name}
      className={cn('size-7 shrink-0 rounded bg-white dark:bg-transparent', className)}
    >
      <image href={BRAND.assets.logo} width="866" height="288" className="dark:hidden" />
      <image
        href={BRAND.assets.logoOnDark}
        width="865"
        height="289"
        className="hidden dark:block"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('block w-40 max-w-full shrink-0', className)}>
      <img
        src={BRAND.assets.logo}
        alt={BRAND.name}
        width="866"
        height="288"
        className="block h-auto w-full dark:hidden"
      />
      <img
        src={BRAND.assets.logoOnDark}
        alt={BRAND.name}
        width="865"
        height="289"
        className="hidden h-auto w-full dark:block"
      />
    </span>
  );
}
