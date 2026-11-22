/**
 * Accesso sicuro a localStorage: può lanciare eccezioni (modalità privata, dati
 * bloccati) e l'app deve funzionare comunque. Usato solo per preferenze di
 * interfaccia, mai per dati dell'utente.
 */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Copia conservativa della preferenza precedente; la nuova chiave ha sempre precedenza. */
export function readStorageWithLegacy(key: string, previousKey: string): string | null {
  const current = readStorage(key);
  if (current !== null) return current;
  const previous = readStorage(previousKey);
  if (previous !== null) writeStorage(key, previous);
  return previous;
}

/** Restituisce `false` se la preferenza non ha potuto essere salvata. */
export function writeStorage(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false; // preferenza non persistita: nessun impatto funzionale
  }
}
