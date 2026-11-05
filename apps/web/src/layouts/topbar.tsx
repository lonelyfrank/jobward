import { Menu as MenuIcon, Plus, Search } from 'lucide-react';
import { useState, type FormEvent, type RefObject } from 'react';
import { useNavigate } from 'react-router';
import { THEME_PREFERENCES, type ThemePreference } from '@meet-roulette/shared';
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
        <Button variant="ghost" size="icon" aria-label="Menu account" className="rounded-full">
          <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
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
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
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

      <span className="truncate text-sm font-medium" data-testid="topbar-title">
        {title}
      </span>

      {/* Ricerca globale: porta alla schermata Opportunità (tutte le bacheche) con il testo cercato. */}
      <form
        role="search"
        onSubmit={submitSearch}
        className="ml-auto hidden max-w-xs flex-1 sm:block"
      >
        <label htmlFor="global-search" className="sr-only">
          Cerca in tutte le bacheche
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="global-search"
            type="search"
            value={term}
            maxLength={100}
            autoComplete="off"
            placeholder="Cerca in tutte le bacheche"
            className="pl-8"
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-1 sm:ml-0">
        <Button
          variant="primary"
          size="sm"
          className="max-md:min-w-11"
          onClick={() => setCreating(true)}
        >
          <Plus aria-hidden="true" />
          <span className="max-sm:sr-only">Nuova scheda</span>
        </Button>
        <UserMenu />
      </div>
      {creating ? <GlobalCreateCardDialog open onOpenChange={setCreating} /> : null}
    </header>
  );
}
