import type { Stage } from './constants';

/**
 * Template iniziali di bacheca.
 *
 * Sono DATI, non logica dell'interfaccia: il frontend li legge, il backend li
 * userà in M1 per creare bacheca e colonne. Aggiungere un template non richiede
 * di toccare componenti React.
 */
export interface BoardTemplateColumn {
  name: string;
  /** Colore semantico (token), non un valore esadecimale. */
  color: 'slate' | 'blue' | 'green' | 'amber' | 'violet' | 'rose';
  /** Fase semantica di default della colonna, se esiste. */
  category: Stage | null;
}

export const BOARD_TEMPLATE_IDS = ['job-search-standard', 'minimal', 'custom'] as const;
export type BoardTemplateId = (typeof BOARD_TEMPLATE_IDS)[number];

export interface BoardTemplate {
  id: BoardTemplateId;
  name: string;
  description: string;
  columns: readonly BoardTemplateColumn[];
}

export const BOARD_TEMPLATES: readonly BoardTemplate[] = [
  {
    id: 'job-search-standard',
    name: 'Job Search Standard',
    description: 'Il percorso classico, dal salvataggio dell’offerta fino al colloquio.',
    columns: [
      { name: 'Salvate', color: 'slate', category: 'saved' },
      { name: 'Da candidarsi', color: 'blue', category: 'preparing' },
      { name: 'Inviate', color: 'violet', category: 'applied' },
      { name: 'Contattato', color: 'amber', category: 'in_contact' },
      { name: 'Colloquio', color: 'green', category: 'interviewing' },
      { name: 'Concluse', color: 'rose', category: 'closed' },
    ],
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Tre colonne essenziali, senza fasi predefinite.',
    columns: [
      { name: 'Da fare', color: 'slate', category: null },
      { name: 'In corso', color: 'blue', category: null },
      { name: 'Completate', color: 'green', category: null },
    ],
  },
  {
    id: 'custom',
    name: 'Personalizzata',
    description: 'Parti da una bacheca vuota e costruisci le tue colonne.',
    columns: [],
  },
];

export function getBoardTemplate(id: BoardTemplateId): BoardTemplate | undefined {
  return BOARD_TEMPLATES.find((template) => template.id === id);
}
