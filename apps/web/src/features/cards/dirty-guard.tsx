import { createContext, useContext, useEffect, type MutableRefObject } from 'react';

/**
 * Registro delle modifiche non salvate della modale. È una REF (nessun re-render): il blocco della
 * navigazione lo legge nel momento in cui qualcuno prova a lasciare la pagina (Esc, X, clic fuori,
 * «indietro»). Ogni parte con una bozza (modulo della scheda, modulo di un colloquio…) si registra
 * con una chiave propria.
 */
export const DirtyGuardContext = createContext<MutableRefObject<Set<string>> | null>(null);

export function useDirtyReporter(key: string, dirty: boolean) {
  const registry = useContext(DirtyGuardContext);
  useEffect(() => {
    if (!registry) return;
    // Il Set è creato una volta sola dalla modale: lo si cattura qui per la pulizia.
    const set = registry.current;
    if (dirty) set.add(key);
    else set.delete(key);
    return () => {
      set.delete(key);
    };
  }, [registry, key, dirty]);
}
