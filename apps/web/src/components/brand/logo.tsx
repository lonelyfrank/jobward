import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/cn';

/**
 * Solo i due chevron blu del marchio (senza la scritta), come la favicon: ritaglio di visualizzazione
 * dei pixel originali, senza ridisegno. I chevron sono identici nelle due varianti, quindi vale per entrambi i temi.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="65 74 160 160"
      role="img"
      aria-label={BRAND.name}
      className={cn('size-7 shrink-0', className)}
    >
      <image href={BRAND.assets.logo} width="866" height="288" />
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
