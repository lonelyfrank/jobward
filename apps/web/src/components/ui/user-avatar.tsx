import { cn } from '@/lib/cn';

export function UserAvatar({ email, className }: { email: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground',
        className,
      )}
    >
      {(email[0] ?? '?').toUpperCase()}
    </span>
  );
}
