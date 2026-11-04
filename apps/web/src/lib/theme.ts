import { THEME_PREFERENCES, type ThemePreference } from '@meet-roulette/shared';
import { useCallback, useEffect, useState } from 'react';
import { readStorage, writeStorage } from './storage';

const KEY = 'mr-theme';

export function getStoredTheme(): ThemePreference {
  const stored = readStorage(KEY);
  return THEME_PREFERENCES.find((p) => p === stored) ?? 'system';
}

function systemPrefersDark(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function applyTheme(preference: ThemePreference): void {
  const dark = preference === 'dark' || (preference === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

/** Preferenza di tema con persistenza e reazione ai cambi del sistema operativo. */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(getStoredTheme);

  const update = useCallback((next: ThemePreference) => {
    writeStorage(KEY, next);
    applyTheme(next);
    setPreference(next);
  }, []);

  useEffect(() => {
    applyTheme(preference);
    if (preference !== 'system' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  return { preference, setPreference: update };
}
