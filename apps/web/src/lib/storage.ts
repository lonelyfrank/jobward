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

/** Restituisce `false` se la preferenza non ha potuto essere salvata. */
export function writeStorage(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false; // preferenza non persistita: nessun impatto funzionale
  }
}
