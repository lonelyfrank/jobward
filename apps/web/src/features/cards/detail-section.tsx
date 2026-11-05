import { ChevronRight } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

/**
 * Sezione del pannello di dettaglio, comprimibile (informazioni progressive: ciò che è vuoto
 * resta chiuso). Si apre da sola se contiene un errore, così non si nasconde mai un problema.
 * Il contenuto resta montato anche da chiuso: la bozza del modulo non si perde.
 */
export function DetailSection({
  title,
  summary,
  defaultOpen,
  hasError = false,
  children,
}: {
  title: string;
  /** Riepilogo mostrato a sezione chiusa (es. "3 campi compilati"). */
  summary?: string | undefined;
  defaultOpen: boolean;
  hasError?: boolean;
  children: ReactNode;
}) {
  // Scelta esplicita dell'utente (null = nessuna): finché c'è un errore la sezione resta aperta.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = hasError || (toggled ?? defaultOpen);
  const bodyId = useId();

  return (
    <section className="rounded-lg border border-border">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setToggled(!open)}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-surface-muted md:min-h-10"
        >
          <ChevronRight
            aria-hidden="true"
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
          />
          {title}
          {!open && summary ? (
            <span className="ml-auto truncate text-xs font-normal text-muted-foreground">
              {summary}
            </span>
          ) : null}
        </button>
      </h3>
      <div id={bodyId} hidden={!open} className="space-y-4 border-t border-border px-3 py-4">
        {children}
      </div>
    </section>
  );
}
