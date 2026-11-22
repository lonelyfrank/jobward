/**
 * Indirizzo del dettaglio di una scheda. Dalla bacheca se la scheda ne ha una; altrimenti dall'elenco
 * Opportunità, che apre la stessa modale senza bacheca (M5-SW.10-a: un'opportunità può non appartenere a
 * nessuna bacheca). `hash` è facoltativo (es. `#colloqui`).
 */
export function cardPath(card: { id: string; boardId: string | null }, hash = ''): string {
  return card.boardId
    ? `/boards/${card.boardId}/cards/${card.id}${hash}`
    : `/opportunities/cards/${card.id}${hash}`;
}

/** Testo mostrato al posto del nome della bacheca/colonna per un'opportunità che non ne ha. */
export const NO_BOARD_LABEL = 'Senza bacheca';
