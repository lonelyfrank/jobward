/**
 * Schede della modale della candidatura. La scheda attiva vive nell'indirizzo (#colloqui…), così è
 * condivisibile. Le sezioni visibili sono quattro (Panoramica, Colloqui, Storico, Dettagli); Storico
 * raccoglie tre viste (tutto, note, documenti) che hanno ciascuna il proprio indirizzo, così i link
 * già esistenti (`#note`, `#documenti`, `#timeline`, `#cronologia`) continuano a funzionare.
 */
export type CardTab = 'overview' | 'interviews' | 'timeline' | 'notes' | 'documents' | 'details';
export type CardSection = 'overview' | 'interviews' | 'history' | 'details';
export type HistoryView = Extract<CardTab, 'timeline' | 'notes' | 'documents'>;

export const CARD_SECTIONS: { id: CardSection; label: string; tab: CardTab }[] = [
  { id: 'overview', label: 'Panoramica', tab: 'overview' },
  { id: 'interviews', label: 'Colloqui', tab: 'interviews' },
  { id: 'history', label: 'Storico', tab: 'timeline' },
  { id: 'details', label: 'Dettagli', tab: 'details' },
];

export const HISTORY_VIEWS: { id: HistoryView; label: string }[] = [
  { id: 'timeline', label: 'Tutto' },
  { id: 'notes', label: 'Note' },
  { id: 'documents', label: 'Documenti' },
];

export const CARD_TABS: { id: CardTab; hash: string }[] = [
  { id: 'overview', hash: '' },
  { id: 'interviews', hash: '#colloqui' },
  { id: 'timeline', hash: '#storico' },
  { id: 'notes', hash: '#note' },
  { id: 'documents', hash: '#documenti' },
  { id: 'details', hash: '#dettagli' },
];

/** Vecchi indirizzi della cronologia: aprono la vista «Tutto» dello Storico. */
const LEGACY_TIMELINE = new Set(['#timeline', '#cronologia']);

export function tabFromHash(hash: string): CardTab {
  if (LEGACY_TIMELINE.has(hash)) return 'timeline';
  return CARD_TABS.find((tab) => tab.hash !== '' && tab.hash === hash)?.id ?? 'overview';
}

export const hashFromTab = (id: CardTab): string =>
  CARD_TABS.find((tab) => tab.id === id)?.hash ?? '';

export const sectionOf = (tab: CardTab): CardSection =>
  tab === 'timeline' || tab === 'notes' || tab === 'documents' ? 'history' : tab;

export const isHistoryView = (tab: CardTab): tab is HistoryView => sectionOf(tab) === 'history';
