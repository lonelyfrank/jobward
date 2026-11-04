import { Menu as MenuIcon, Plus, Search } from 'lucide-react';
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
    <DropdownMenu>
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

export function Topbar({ title, onOpenNav }: { title: string; onOpenNav: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      <Button
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

      {/* Ricerca e creazione rapida arrivano con le schede (M1/M2): qui sono dichiarate, non simulate. */}
      <div role="search" className="ml-auto hidden max-w-xs flex-1 sm:block">
        <label htmlFor="global-search" className="sr-only">
          Cerca (disponibile in M2)
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="global-search"
            disabled
            placeholder="Cerca · in arrivo (M2)"
            className="pl-8"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1 sm:ml-0">
        <Button
          variant="primary"
          size="sm"
          disabled
          aria-describedby="quick-create-note"
          title="Disponibile in M1"
        >
          <Plus aria-hidden="true" />
          <span className="max-sm:sr-only">Nuova scheda</span>
        </Button>
        <span id="quick-create-note" className="sr-only">
          Non ancora disponibile: la creazione di schede arriva in M1.
        </span>
        <UserMenu />
      </div>
    </header>
  );
}
