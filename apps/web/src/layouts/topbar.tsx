import { Menu as MenuIcon, Plus, Search } from 'lucide-react';
import { useState, type FormEvent, type RefObject } from 'react';
import { useNavigate } from 'react-router';
import { THEME_PREFERENCES, type ThemePreference } from '@jobward/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { GlobalCreateCardDialog } from '@/features/kanban/global-create';
import { useWorkspace } from '@/features/workspace/context';
import { useTheme } from '@/lib/theme';

const THEME_LABELS: Record<ThemePreference, string> = {
  light: 'Chiaro',
  dark: 'Scuro',
  system: 'Come il sistema',
};

function UserMenu() {
  const { user } = useWorkspace();
  const { preference, setPreference } = useTheme();
  const initial = (user.email[0] ?? '?').toUpperCase();

  return (
    // Non modale: il menu è un popover. Un menu modale nasconde tutta l'app con aria-hidden
    // (axe: aria-hidden-focus) e blocca lo scroll iniettando uno <style> (incompatibile con una CSP stretta).
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menu account" className="p-0">
          <span className="grid size-full place-items-center rounded-md bg-primary-soft text-[15px] font-semibold text-primary-soft-foreground">
            {initial}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => setPreference(value as ThemePreference)}
        >
          {THEME_PREFERENCES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {THEME_LABELS[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar({
  title,
  onOpenNav,
  menuButtonRef,
}: {
  title: string;
  onOpenNav: () => void;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  const [creating, setCreating] = useState(false);
  const [term, setTerm] = useState('');
  const navigate = useNavigate();
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const q = term.trim();
    void navigate(q ? `/opportunities?q=${encodeURIComponent(q)}` : '/opportunities');
    setTerm('');
  };
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-4 sm:px-8 md:h-[86px] lg:px-11">
      <Button
        ref={menuButtonRef}
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onOpenNav}
        aria-label="Apri il menu di navigazione"
      >
        <MenuIcon aria-hidden="true" />
      </Button>

      <nav aria-label="Percorso" className="min-w-0 truncate text-sm text-muted-foreground">
        <span className="max-sm:hidden">
          Workspace <span aria-hidden="true">/</span>{' '}
        </span>
        <span className="font-semibold text-foreground" data-testid="topbar-title">
          {title}
        </span>
      </nav>

      {/* Ricerca globale: porta alla schermata Opportunità (tutte le bacheche) con il testo cercato. */}
      <form
        role="search"
        onSubmit={submitSearch}
        className="ml-auto hidden min-w-0 max-w-[18rem] flex-1 sm:block"
      >
        <label htmlFor="global-search" className="sr-only">
          Cerca in tutte le bacheche
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="global-search"
            type="search"
            value={term}
            maxLength={100}
            autoComplete="off"
            placeholder="Cerca in tutte le bacheche"
            className="h-[42px] pl-9"
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-3 sm:ml-0">
        <Button
          variant="secondary"
          size="sm"
          className="max-md:min-w-11"
          onClick={() => setCreating(true)}
        >
          <Plus aria-hidden="true" />
          <span className="max-lg:sr-only">Nuova scheda</span>
        </Button>
        <UserMenu />
      </div>
      {creating ? <GlobalCreateCardDialog open onOpenChange={setCreating} /> : null}
    </header>
  );
}
