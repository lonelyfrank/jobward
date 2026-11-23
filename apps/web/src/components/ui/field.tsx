import type { ReactNode } from 'react';

/** Etichetta + controllo + errore annunciato agli screen reader. */
export function Field({
  id,
  label,
  hint,
  error,
  icon,
  children,
}: {
  id: string;
  label: string;
  /** Icona facoltativa prima dell'etichetta (decorativa). */
  icon?: ReactNode;
  hint?: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className={
          icon
            ? 'flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase [&_svg]:size-3.5'
            : 'block text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase'
        }
      >
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
