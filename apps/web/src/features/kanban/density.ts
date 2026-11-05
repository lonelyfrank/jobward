import { useSyncExternalStore } from 'react';
import { readStorage, writeStorage } from '@/lib/storage';

/**
 * Densità delle schede del Kanban: preferenza visiva LOCALE al dispositivo (come le colonne della
 * tabella), condivisa in tempo reale tra tutte le schede senza ricaricare nulla.
 */
export type Density = 'compact' | 'informative';
const KEY = 'mr.kanban.density.v1';
const listeners = new Set<() => void>();

function read(): Density {
  return readStorage(KEY) === 'compact' ? 'compact' : 'informative';
}

export function setDensity(value: Density) {
  writeStorage(KEY, value);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function useDensity(): Density {
  return useSyncExternalStore(subscribe, read, () => 'informative');
}
