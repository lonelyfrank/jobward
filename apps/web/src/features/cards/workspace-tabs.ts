/** Schede della modale della candidatura. La scheda attiva vive nell'indirizzo (#colloqui…), così è condivisibile. */
export type CardTab = 'overview' | 'interviews' | 'timeline' | 'notes' | 'documents' | 'details';

export const CARD_TABS: { id: CardTab; label: string; hash: string }[] = [
  { id: 'overview', label: 'Panoramica', hash: '' },
  { id: 'interviews', label: 'Colloqui', hash: '#colloqui' },
  { id: 'timeline', label: 'Timeline', hash: '#timeline' },
  { id: 'notes', label: 'Note', hash: '#note' },
  { id: 'documents', label: 'Documenti', hash: '#documenti' },
  { id: 'details', label: 'Dettagli', hash: '#dettagli' },
];

export function tabFromHash(hash: string): CardTab {
  if (hash === '#cronologia') return 'timeline';
  return CARD_TABS.find((tab) => tab.hash !== '' && tab.hash === hash)?.id ?? 'overview';
}

export const hashFromTab = (id: CardTab): string =>
  CARD_TABS.find((tab) => tab.id === id)?.hash ?? '';
