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

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* preferenza non persistita: nessun impatto funzionale */
  }
}
