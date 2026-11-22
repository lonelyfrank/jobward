import { describe, expect, it } from 'vitest';
import { STAGES } from './constants';
import { BOARD_TEMPLATES, getBoardTemplate } from './templates';

describe('BOARD_TEMPLATES', () => {
  it('espone i tre template previsti dalla specifica', () => {
    expect(BOARD_TEMPLATES.map((t) => t.id)).toEqual(['job-search-standard', 'minimal', 'custom']);
  });

  it('Job Search Standard ha le sei colonne attese, nell’ordine corretto', () => {
    const template = getBoardTemplate('job-search-standard');
    expect(template?.columns.map((c) => c.name)).toEqual([
      'Salvate',
      'Da candidarsi',
      'Inviate',
      'Contattato',
      'Colloquio',
      'Concluse',
    ]);
  });

  it('Minimal ha tre colonne e nessuna fase semantica imposta', () => {
    const template = getBoardTemplate('minimal');
    expect(template?.columns.map((c) => c.name)).toEqual(['Da fare', 'In corso', 'Completate']);
    expect(template?.columns.every((c) => c.category === null)).toBe(true);
  });

  it('Custom parte senza colonne', () => {
    expect(getBoardTemplate('custom')?.columns).toHaveLength(0);
  });

  it('usa solo fasi semantiche valide e nomi di colonna unici per template', () => {
    for (const template of BOARD_TEMPLATES) {
      const names = template.columns.map((c) => c.name);
      expect(new Set(names).size).toBe(names.length);
      for (const column of template.columns) {
        if (column.category) expect(STAGES).toContain(column.category);
      }
    }
  });
});
