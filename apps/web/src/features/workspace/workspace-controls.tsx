import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefCallback,
} from 'react';

const GlobalSearchDialog = lazy(() =>
  import('./global-search-dialog').then((module) => ({ default: module.GlobalSearchDialog })),
);
const GlobalCreateCardDialog = lazy(() =>
  import('@/features/kanban/global-create').then((module) => ({
    default: module.GlobalCreateCardDialog,
  })),
);

type Controls = {
  openSearch: () => void;
  createCard: (boardId?: string) => void;
  onOpenNav: () => void;
  setMenuButton: RefCallback<HTMLButtonElement>;
};
const Context = createContext<Controls | null>(null);
export function useWorkspaceControls() {
  const context = useContext(Context);
  if (!context) throw new Error('WorkspaceControlsProvider mancante');
  return context;
}

export function WorkspaceControlsProvider({
  children,
  onOpenNav,
  setMenuButton,
}: Pick<Controls, 'onOpenNav' | 'setMenuButton'> & { children: ReactNode }) {
  const [searching, setSearching] = useState<{ returnFocus: HTMLElement | null } | null>(null);
  const [creating, setCreating] = useState<{ boardId?: string } | null>(null);
  const openSearch = useCallback(() => {
    // Non aprire un secondo dialog sopra editor, conferme o moduli attivi.
    if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
    setSearching({
      returnFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    });
  }, []);
  const createCard = useCallback((boardId?: string) => setCreating(boardId ? { boardId } : {}), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        !event.isComposing &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openSearch]);
  const value = useMemo(
    () => ({ openSearch, createCard, onOpenNav, setMenuButton }),
    [openSearch, createCard, onOpenNav, setMenuButton],
  );
  return (
    <Context.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        {searching ? (
          <GlobalSearchDialog
            onClose={() => setSearching(null)}
            returnFocus={searching.returnFocus}
          />
        ) : null}
        {creating ? (
          <GlobalCreateCardDialog
            open
            initialBoardId={creating.boardId}
            onOpenChange={(open) => !open && setCreating(null)}
          />
        ) : null}
      </Suspense>
    </Context.Provider>
  );
}
