import { readStorage, writeStorage } from '@/lib/storage';

/**
 * «Non ora» dei suggerimenti: preferenza PER DISPOSITIVO (localStorage, D-09). Nessun dato riservato:
 * solo workspace e chiave della regola. Se lo storage non c'è, il suggerimento riappare (nessun errore).
 */
const storageKey = (workspaceId: string, key: string) =>
  `jobward:task-suggestion:${workspaceId}:${key}`;

export const isSuggestionDismissed = (workspaceId: string, key: string): boolean =>
  readStorage(storageKey(workspaceId, key)) === '1';

export const dismissSuggestion = (workspaceId: string, key: string): boolean =>
  writeStorage(storageKey(workspaceId, key), '1');
