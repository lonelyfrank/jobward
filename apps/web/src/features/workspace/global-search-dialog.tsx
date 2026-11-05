import { globalSearchResponse } from '@jobward/schemas';
import { LIMITS } from '@jobward/shared';
import { useQuery } from '@tanstack/react-query';
import { BriefcaseBusiness, CalendarDays, Search, SquareKanban } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Dialog, DialogCloseButton } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { keys, scoped } from '@/features/boards/api';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useWorkspace } from './context';

/** Montata soltanto quando aperta: lo smontaggio annulla debounce e richieste tramite Query. */
export function GlobalSearchDialog({
  onClose,
  returnFocus,
}: {
  onClose: () => void;
  returnFocus: HTMLElement | null;
}) {
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState(0);
  const navigating = useRef(false);
  const listId = useId();
  const term = text.trim();
  const valid = term.split(/\s+/).length <= LIMITS.searchTermsMax;
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(term), 250);
    return () => window.clearTimeout(timeout);
  }, [term]);
  const query = useQuery({
    queryKey: [...keys.opportunities(workspace.id), 'global-search', debounced],
    queryFn: ({ signal }) =>
      apiRequest(
        scoped(workspace.id, `/search?${new URLSearchParams({ q: debounced })}`),
        globalSearchResponse,
        { signal },
      ),
    enabled: debounced !== '' && valid && term === debounced,
    staleTime: 30_000,
    retry: (count, error) =>
      !(error instanceof ApiRequestError && error.status >= 400 && error.status < 500) && count < 1,
    retryDelay: 400,
  });
  const loading = term !== '' && valid && (term !== debounced || query.isFetching);
  const data = !loading && term !== '' && valid && !query.isError ? query.data : undefined;
  const groups = [
    {
      label: 'Opportunità',
      icon: BriefcaseBusiness,
      items: (data?.opportunities ?? []).map((item) => ({
        ...item,
        title: item.archived ? `${item.title} · Archiviata` : item.title,
        key: `card-${item.id}`,
        to: `/boards/${item.boardId}/cards/${item.id}`,
      })),
    },
    {
      label: 'Bacheche',
      icon: SquareKanban,
      items: (data?.boards ?? []).map((item) => ({
        ...item,
        key: `board-${item.id}`,
        to: `/boards/${item.id}`,
      })),
    },
    {
      label: 'Colloqui',
      icon: CalendarDays,
      items: (data?.interviews ?? []).map((item) => ({
        ...item,
        key: `interview-${item.id}`,
        to: `/boards/${item.boardId}/cards/${item.cardId}#colloqui`,
      })),
    },
  ];
  const results = groups.flatMap((group) => group.items);
  const activeIndex = results.length ? Math.min(selected, results.length - 1) : -1;
  const active = results[activeIndex];
  useEffect(() => {
    if (active)
      document.getElementById(`${listId}-${active.key}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, listId]);
  const openResult = (to: string) => {
    navigating.current = true;
    onClose();
    void navigate(to);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      variant="search"
      title="Cerca in Jobward"
      description="Cerca opportunità, bacheche e colloqui in tutto il workspace."
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        if (!navigating.current) {
          const target = returnFocus?.isConnected ? returnFocus : document.getElementById('main');
          target?.focus({ preventScroll: true });
        }
      }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border p-3 sm:p-4">
        <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        <Input
          role="combobox"
          aria-label="Cerca in Jobward"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-activedescendant={active ? `${listId}-${active.key}` : undefined}
          value={text}
          maxLength={LIMITS.searchTextMax}
          autoComplete="off"
          placeholder="Cerca in Jobward…"
          className="min-w-0 flex-1"
          onChange={(event) => {
            setText(event.target.value);
            setSelected(0);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && results.length) {
              event.preventDefault();
              setSelected(
                (current) =>
                  (Math.min(current, results.length - 1) +
                    (event.key === 'ArrowDown' ? 1 : -1) +
                    results.length) %
                  results.length,
              );
            }
            if (event.key === 'Enter' && active) {
              event.preventDefault();
              openResult(active.to);
            }
          }}
        />
        <DialogCloseButton />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
        <p role="status" aria-live="polite" className="mb-2 text-sm text-muted-foreground">
          {!term
            ? 'Cerca tra tutte le bacheche, incluse le schede archiviate.'
            : !valid
              ? `Usa al massimo ${LIMITS.searchTermsMax} parole.`
              : loading
                ? 'Ricerca in corso…'
                : query.isError
                  ? ''
                  : `${results.length} ${results.length === 1 ? 'risultato' : 'risultati'}. Fino a 10 per categoria.`}
        </p>
        {query.isError && !loading && valid && term ? (
          <div role="alert" className="space-y-3 p-2">
            <p>Non riusciamo a cercare. Riprova tra un momento.</p>
            <Button variant="secondary" onClick={() => void query.refetch()}>
              Riprova
            </Button>
          </div>
        ) : null}
        {!loading && data && !results.length ? (
          <p className="p-2 text-sm">Nessun risultato per “{term}”.</p>
        ) : null}
        <div id={listId} role="listbox" aria-label="Risultati della ricerca" aria-busy={loading}>
          {groups
            .filter((group) => group.items.length)
            .map(({ label, icon: Icon, items }) => (
              <div key={label} role="group" aria-label={label} className="mb-4 last:mb-0">
                <p
                  aria-hidden="true"
                  className="mb-1 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {label}
                </p>
                {items.map((item) => (
                  <Link
                    id={`${listId}-${item.key}`}
                    key={item.key}
                    role="option"
                    aria-selected={active?.key === item.key}
                    to={item.to}
                    tabIndex={-1}
                    className={cn(
                      'flex min-h-14 items-center gap-3 rounded-md px-3 py-2 hover:bg-hover-soft',
                      active?.key === item.key && 'bg-primary-soft text-primary-soft-foreground',
                    )}
                    onPointerMove={() =>
                      setSelected(results.findIndex((result) => result.key === item.key))
                    }
                    onClick={(event) => {
                      if (
                        !event.ctrlKey &&
                        !event.metaKey &&
                        !event.shiftKey &&
                        event.button === 0
                      ) {
                        event.preventDefault();
                        openResult(item.to);
                      }
                    }}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.subtitle}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            ))}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <span>↑↓ Naviga · Invio Apri · Esc Chiudi</span>
        <span>Ctrl / ⌘ K</span>
      </div>
    </Dialog>
  );
}
