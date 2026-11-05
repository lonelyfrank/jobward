/** Schede della modale della candidatura. La scheda attiva vive nell'indirizzo (#colloqui…), così è condivisibile. */
export type CardTab = 'overview' | 'interviews' | 'details' | 'history';

export const CARD_TABS: { id: CardTab; label: string; hash: string }[] = [
  { id: 'overview', label: 'Panoramica', hash: '' },
  { id: 'interviews', label: 'Colloqui', hash: '#colloqui' },
  { id: 'details', label: 'Dettagli', hash: '#dettagli' },
  { id: 'history', label: 'Cronologia', hash: '#cronologia' },
];

export function tabFromHash(hash: string): CardTab {
  return CARD_TABS.find((tab) => tab.hash !== '' && tab.hash === hash)?.id ?? 'overview';
}

export const hashFromTab = (id: CardTab): string =>
  CARD_TABS.find((tab) => tab.id === id)?.hash ?? '';
