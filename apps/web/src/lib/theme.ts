import { THEME_PREFERENCES, type ThemePreference } from '@meet-roulette/shared';
import { useEffect, useSyncExternalStore } from 'react';
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

/**
 * Store unico della preferenza di tema.
 *
 * Più componenti la mostrano (menu account, Impostazioni): lo stato non può essere locale a
 * ciascuno, altrimenti restano disallineati. `memory` serve solo se localStorage non è
 * scrivibile: la scelta vale comunque per la sessione.
 */
const listeners = new Set<() => void>();
let memory: ThemePreference | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = (): ThemePreference => memory ?? getStoredTheme();

function setTheme(next: ThemePreference) {
  memory = writeStorage(KEY, next) ? null : next;
  applyTheme(next);
  listeners.forEach((listener) => listener());
}

/** Preferenza di tema con persistenza e reazione ai cambi del sistema operativo. */
export function useTheme() {
  const preference = useSyncExternalStore(subscribe, getSnapshot, () => 'system' as const);

  useEffect(() => {
    applyTheme(preference);
    if (preference !== 'system' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  return { preference, setPreference: setTheme };
}
