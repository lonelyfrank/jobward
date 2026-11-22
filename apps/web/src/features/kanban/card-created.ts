import type { Card } from '@jobward/schemas';

/**
 * Annuncio «scheda creata». La creazione parte da due punti (colonna e «Nuova scheda» globale) che
 * non sanno nulla dei filtri della bacheca aperta; chi li conosce (il provider dei filtri) si
 * iscrive qui. Solo la creazione: modifiche e spostamenti non passano da questo canale.
 */
type Listener = (card: Card) => void;

const listeners = new Set<Listener>();

export function onCardCreated(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitCardCreated(card: Card): void {
  for (const listener of [...listeners]) listener(card);
}
