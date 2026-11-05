import { COLOR_TOKENS, type ColorToken } from '@jobward/schemas';
import { Check } from 'lucide-react';
import { COLOR_BG, COLOR_LABELS } from '@/lib/labels';
import { cn } from '@/lib/cn';

/**
 * Scelta del colore tra i token ammessi. Gruppo di radio nativi: frecce per spostarsi,
 * il nome del colore è sempre il testo accessibile (il campione da solo non basterebbe).
 */
export function ColorPicker({
  name,
  value,
  onChange,
  allowNone = true,
}: {
  name: string;
  value: ColorToken | null;
  onChange: (value: ColorToken | null) => void;
  allowNone?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Colore" className="flex flex-wrap gap-2">
      {allowNone ? (
        <label className="relative">
          <input
            type="radio"
            name={name}
            className="peer sr-only"
            checked={value === null}
            onChange={() => onChange(null)}
          />
          <span className="flex h-8 items-center rounded-full border border-border-strong px-3 text-xs peer-checked:bg-surface-muted peer-checked:font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring max-md:h-11">
            Nessuno
          </span>
        </label>
      ) : null}
      {COLOR_TOKENS.map((token) => (
        <label key={token} className="relative">
          <input
            type="radio"
            name={name}
            className="peer sr-only"
            checked={value === token}
            onChange={() => onChange(token)}
          />
          <span
            title={COLOR_LABELS[token]}
            className={cn(
              'grid size-8 place-items-center rounded-full text-surface ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring max-md:size-11',
              COLOR_BG[token],
            )}
          >
            {value === token ? <Check aria-hidden="true" className="size-4" /> : null}
            <span className="sr-only">{COLOR_LABELS[token]}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
