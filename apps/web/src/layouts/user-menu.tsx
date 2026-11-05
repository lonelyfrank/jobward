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
import { useWorkspace } from '@/features/workspace/context';
import { useTheme } from '@/lib/theme';

const THEME_LABELS: Record<ThemePreference, string> = {
  light: 'Chiaro',
  dark: 'Scuro',
  system: 'Come il sistema',
};

export function UserMenu() {
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
