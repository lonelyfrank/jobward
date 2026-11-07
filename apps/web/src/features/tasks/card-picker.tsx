import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOpportunities } from '@/features/opportunities/api';

export interface PickedCard {
  id: string;
  title: string;
  company: string | null;
}

const label = (c: PickedCard) => (c.company ? `${c.company} · ${c.title}` : c.title);

/**
 * Collegamento facoltativo a una candidatura del workspace (ricerca sulle opportunità non archiviate).
 * Selezione con pulsanti reali (nessun ARIA combobox improvvisato): accessibile da tastiera e touch.
 */
export function CardPicker({
  value,
  onChange,
  disabled,
  fixed = false,
}: {
  value: PickedCard | null;
  onChange: (card: PickedCard | null) => void;
  disabled: boolean;
  /** Aperta da una candidatura: il collegamento è fisso. */
  fixed?: boolean;
}) {
  const [q, setQ] = useState('');
  const query = q.trim();
  const results = useOpportunities({ q: query, pageSize: '6', archived: 'exclude' });
  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border-strong px-3 py-2 text-sm">
        <span className="min-w-0 truncate" data-testid="task-linked-card">
          {label(value)}
        </span>
        {!fixed ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label="Rimuovi il collegamento alla candidatura"
            onClick={() => onChange(null)}
          >
            <X aria-hidden="true" />
            Rimuovi
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground"
        />
        <Input
          id="task-card-search"
          type="search"
          value={q}
          disabled={disabled}
          placeholder="Cerca per titolo o azienda (facoltativo)"
          className="pl-9"
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {query ? (
        <div aria-live="polite">
          {results.isPending ? (
            <p className="text-sm text-muted-foreground">Ricerca in corso…</p>
          ) : results.isError ? (
            <p role="alert" className="text-sm text-danger">
              Ricerca non riuscita. Riprova.
            </p>
          ) : results.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna candidatura trovata.</p>
          ) : (
            <ul
              aria-label="Candidature trovate"
              className="divide-y divide-border rounded-md border border-border"
            >
              {results.data.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    className="flex min-h-11 w-full items-center px-3 py-2 text-left text-sm hover:bg-hover-soft focus-visible:bg-hover-soft"
                    onClick={() => {
                      onChange({ id: item.id, title: item.title, company: item.company });
                      setQ('');
                    }}
                  >
                    {item.company ? `${item.company} · ` : ''}
                    {item.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
