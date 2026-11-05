import { describe, expect, it } from 'vitest';
import {
  applicationDetailsInput,
  createBoardInput,
  createCardInput,
  createColumnInput,
  createTaskInput,
  createWorkspaceInput,
  deleteColumnInput,
  moveCardInput,
  moveInput,
  updateBoardInput,
  updateCardInput,
  updateColumnInput,
  customFieldDefinitionInput,
  parseStoredCustomFieldValue,
  serializeCustomFieldValue,
  validateCustomFieldValue,
  type CustomFieldDefinitionInput,
  type CustomFieldValue,
} from './index';

describe('createCardInput', () => {
  it('accetta una scheda con il solo titolo (più la colonna)', () => {
    const parsed = createCardInput.parse({ title: '  Barista part-time  ', columnId: 'c1' });
    expect(parsed.title).toBe('Barista part-time');
    expect(parsed.priority).toBe('none');
    expect(parsed.details).toBeUndefined();
  });

  it('rifiuta titolo vuoto o composto solo da spazi', () => {
    expect(createCardInput.safeParse({ title: '   ', columnId: 'c1' }).success).toBe(false);
    expect(createCardInput.safeParse({ columnId: 'c1' }).success).toBe(false);
  });

  it('rifiuta priorità fuori vocabolario', () => {
    expect(
      createCardInput.safeParse({ title: 'x', columnId: 'c1', priority: 'critical' }).success,
    ).toBe(false);
  });

  it.each(['none', 'low', 'medium', 'high', 'urgent'])('accetta la priorità %s', (priority) => {
    expect(createCardInput.safeParse({ title: 'x', columnId: 'c1', priority }).success).toBe(true);
  });
});

describe('applicationDetailsInput', () => {
  it('accetta un oggetto vuoto: nessun campo è obbligatorio', () => {
    expect(applicationDetailsInput.safeParse({}).success).toBe(true);
  });

  it('rifiuta retribuzione minima superiore alla massima', () => {
    const r = applicationDetailsInput.safeParse({ salaryMin: 50_000, salaryMax: 30_000 });
    expect(r.success).toBe(false);
  });

  it('accetta solo URL http(s), scartando schemi pericolosi', () => {
    expect(
      applicationDetailsInput.safeParse({ sourceUrl: 'https://example.com/job/1' }).success,
    ).toBe(true);
    expect(applicationDetailsInput.safeParse({ sourceUrl: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(applicationDetailsInput.safeParse({ sourceUrl: 'data:text/html,hi' }).success).toBe(
      false,
    );
  });

  it('valida le date di calendario, incluse quelle inesistenti', () => {
    expect(applicationDetailsInput.safeParse({ appliedOn: '2026-02-28' }).success).toBe(true);
    expect(applicationDetailsInput.safeParse({ appliedOn: '2026-02-30' }).success).toBe(false);
    expect(applicationDetailsInput.safeParse({ appliedOn: '28/02/2026' }).success).toBe(false);
  });

  it('mantiene fase ed esito come concetti distinti', () => {
    const r = applicationDetailsInput.parse({ stage: 'closed', outcome: 'rejected' });
    expect(r.stage).toBe('closed');
    expect(r.outcome).toBe('rejected');
    expect(applicationDetailsInput.safeParse({ stage: 'rejected' }).success).toBe(false);
  });

  it('richiede un codice valuta ISO a tre lettere maiuscole', () => {
    expect(applicationDetailsInput.safeParse({ currency: 'EUR' }).success).toBe(true);
    expect(applicationDetailsInput.safeParse({ currency: 'euro' }).success).toBe(false);
  });
});

describe('workspace, board, column, task', () => {
  it('createWorkspaceInput valida il fuso orario IANA', () => {
    expect(
      createWorkspaceInput.safeParse({ name: 'Ricerca 2026', timezone: 'Europe/Rome' }).success,
    ).toBe(true);
    expect(createWorkspaceInput.safeParse({ name: 'x', timezone: 'Mars/Olympus' }).success).toBe(
      false,
    );
    expect(createWorkspaceInput.parse({ name: 'x' }).timezone).toBe('UTC');
  });

  it('createBoardInput richiede il nome e non accetta colori arbitrari', () => {
    expect(createBoardInput.safeParse({ name: '' }).success).toBe(false);
    expect(createBoardInput.safeParse({ name: 'Ok', color: 'url(javascript:1)' }).success).toBe(
      false,
    );
    expect(createBoardInput.parse({ name: 'Ok' }).color).toBeNull();
  });

  it('createColumnInput accetta una categoria semantica facoltativa', () => {
    expect(createColumnInput.parse({ name: 'Inviate', category: 'applied' }).category).toBe(
      'applied',
    );
    expect(createColumnInput.safeParse({ name: 'x', category: 'boh' }).success).toBe(false);
  });

  it('createTaskInput accetta scadenze come istanti ISO con offset', () => {
    expect(
      createTaskInput.safeParse({ title: 'Richiama HR', dueAt: '2026-11-10T09:00:00+01:00' })
        .success,
    ).toBe(true);
    expect(createTaskInput.safeParse({ title: 'x', dueAt: '10/11/2026' }).success).toBe(false);
    expect(createTaskInput.safeParse({ title: '' }).success).toBe(false);
  });
});

describe('campi personalizzati', () => {
  const def = (input: unknown): CustomFieldDefinitionInput =>
    customFieldDefinitionInput.parse(input);

  const select = def({
    name: 'Livello',
    type: 'single_select',
    config: {
      options: [
        { id: 'jr', label: 'Junior' },
        { id: 'sr', label: 'Senior' },
      ],
    },
  });
  const multi = def({
    name: 'Benefit',
    type: 'multi_select',
    config: {
      options: [
        { id: 'a', label: 'Buoni pasto' },
        { id: 'b', label: 'Formazione' },
      ],
    },
  });

  it('richiede almeno un’opzione nei campi a selezione e ID unici', () => {
    expect(
      customFieldDefinitionInput.safeParse({
        name: 'x',
        type: 'single_select',
        config: { options: [] },
      }).success,
    ).toBe(false);
    expect(
      customFieldDefinitionInput.safeParse({
        name: 'x',
        type: 'multi_select',
        config: {
          options: [
            { id: 'a', label: 'A' },
            { id: 'a', label: 'B' },
          ],
        },
      }).success,
    ).toBe(false);
  });

  it('rifiuta un tipo sconosciuto', () => {
    expect(
      customFieldDefinitionInput.safeParse({ name: 'x', type: 'rating', config: {} }).success,
    ).toBe(false);
  });

  it('valida i valori rispetto al tipo della definizione', () => {
    const text = def({ name: 'Note', type: 'text', config: { maxLength: 5 } });
    expect(validateCustomFieldValue(text, 'ciao').success).toBe(true);
    expect(validateCustomFieldValue(text, 'troppo lungo').success).toBe(false);
    expect(validateCustomFieldValue(text, 42).success).toBe(false);

    const num = def({
      name: 'Km',
      type: 'number',
      config: { min: 0, max: 100, integerOnly: true },
    });
    expect(validateCustomFieldValue(num, 10).success).toBe(true);
    expect(validateCustomFieldValue(num, 10.5).success).toBe(false);
    expect(validateCustomFieldValue(num, 101).success).toBe(false);
    expect(validateCustomFieldValue(num, '10').success).toBe(false);

    expect(
      validateCustomFieldValue(def({ name: 'D', type: 'date', config: {} }), '2026-11-04').success,
    ).toBe(true);
    expect(
      validateCustomFieldValue(def({ name: 'D', type: 'date', config: {} }), '2026-13-01').success,
    ).toBe(false);
    expect(
      validateCustomFieldValue(def({ name: 'B', type: 'boolean', config: {} }), 'true').success,
    ).toBe(false);
    expect(
      validateCustomFieldValue(def({ name: 'U', type: 'url', config: {} }), 'javascript:1').success,
    ).toBe(false);
  });

  it('valida le selezioni contro le opzioni definite', () => {
    expect(validateCustomFieldValue(select, 'jr').success).toBe(true);
    expect(validateCustomFieldValue(select, 'lead').success).toBe(false);
    expect(validateCustomFieldValue(multi, ['a', 'b']).success).toBe(true);
    expect(validateCustomFieldValue(multi, ['a', 'zzz']).success).toBe(false);
    expect(validateCustomFieldValue(multi, ['a', 'a']).success).toBe(false);
  });

  it('accetta null come "campo svuotato" per ogni tipo', () => {
    for (const d of [select, multi]) expect(validateCustomFieldValue(d, null).success).toBe(true);
  });

  it('serializza e rilegge i valori senza perdere il tipo', () => {
    const values: CustomFieldValue[] = [
      'testo',
      42,
      0,
      3.14,
      true,
      false,
      ['a', 'b'],
      [],
      null,
      '2026-11-04',
    ];
    for (const value of values) {
      const roundTripped = parseStoredCustomFieldValue(serializeCustomFieldValue(value));
      expect(roundTripped).toStrictEqual(value);
      expect(typeof roundTripped).toBe(typeof value);
    }
  });
});

describe('contratti M1 (bacheche, colonne, schede)', () => {
  it('createBoardInput: template di default "custom", solo template noti', () => {
    expect(createBoardInput.parse({ name: 'x' }).templateId).toBe('custom');
    expect(createBoardInput.parse({ name: 'x', templateId: 'minimal' }).templateId).toBe('minimal');
    expect(createBoardInput.safeParse({ name: 'x', templateId: 'altro' }).success).toBe(false);
  });

  it.each([
    ['updateBoardInput', updateBoardInput],
    ['updateColumnInput', updateColumnInput],
    ['updateCardInput', updateCardInput],
  ])(
    '%s: richiede almeno un campo e rifiuta campi sconosciuti (nessun mass-assignment)',
    (_n, schema) => {
      expect(schema.safeParse({}).success).toBe(false);
      expect(schema.safeParse({ workspaceId: 'altro', name: 'x', title: 'x' }).success).toBe(false);
      expect(schema.safeParse({ position: 3 }).success).toBe(false);
    },
  );

  it('updateCardInput: modifiche parziali valide, URL solo http(s), null azzera', () => {
    expect(updateCardInput.parse({ description: null }).description).toBeNull();
    expect(updateCardInput.parse({ title: '  Nuovo  ' }).title).toBe('Nuovo');
    expect(updateCardInput.safeParse({ sourceUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(updateCardInput.safeParse({ sourceUrl: 'https://example.com/a' }).success).toBe(true);
    expect(updateCardInput.safeParse({ priority: 'critical' }).success).toBe(false);
    expect(updateCardInput.safeParse({ archivedAt: 1 }).success).toBe(false);
  });

  it('createCardInput: i dettagli di M1 sono azienda e URL; i campi di M2 sono rifiutati, non ignorati', () => {
    expect(
      createCardInput.safeParse({ title: 'x', columnId: 'c', details: { company: 'ACME' } })
        .success,
    ).toBe(true);
    expect(
      createCardInput.safeParse({ title: 'x', columnId: 'c', details: { salaryMin: 1 } }).success,
    ).toBe(false);
  });

  it('moveInput / moveCardInput: ancora esplicita (null = in cima), nessun indice', () => {
    expect(moveInput.parse({ afterId: null }).afterId).toBeNull();
    expect(moveInput.safeParse({}).success).toBe(false);
    expect(moveInput.safeParse({ afterId: 'a', index: 2 }).success).toBe(false);
    expect(moveCardInput.safeParse({ columnId: 'c', afterCardId: null }).success).toBe(true);
    expect(moveCardInput.safeParse({ columnId: 'c' }).success).toBe(false);
  });

  it('deleteColumnInput: destinazione facoltativa, nient’altro', () => {
    expect(deleteColumnInput.parse({}).moveCardsToColumnId).toBeNull();
    expect(deleteColumnInput.safeParse({ force: true }).success).toBe(false);
  });
});
