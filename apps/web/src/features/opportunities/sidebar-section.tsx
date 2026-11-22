import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/** Le categorie restano richiudibili anche quando contengono selezioni attive. */
export function SidebarSection({
  title,
  count = 0,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || count > 0);
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group min-w-0 border-b border-border last:border-0"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-hover-soft focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 break-words">{title}</span>
        {count > 0 ? (
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary-soft-foreground">
            {count}
            <span className="sr-only"> selezionati</span>
          </span>
        ) : null}
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="min-w-0 px-3 pt-1 pb-3">{children}</div>
    </details>
  );
}

export const sidebarCheckClass =
  'flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-hover-soft has-[:checked]:bg-primary-soft has-[:checked]:text-primary-soft-foreground has-[:disabled]:cursor-default max-md:min-h-11';
