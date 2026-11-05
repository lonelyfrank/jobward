import type { CustomField } from '@meet-roulette/schemas';
import { describe, expect, it } from 'vitest';
import { displayValue, draftFromValue, sameValue, valueFromDraft } from './values';

const meta = { id: 'f', boardId: 'b', position: 1, valueCount: 0, createdAt: 1, updatedAt: 1 };
const field = (over: object): CustomField =>
  ({ name: 'Campo', isActive: true, ...meta, ...over }) as CustomField;
const options = [
  { id: 'o1', label: 'Giorno', color: null },
  { id: 'o2', label: 'Notte', color: null },
];

describe('bozza → valore tipizzato', () => {
  it('numero: i numeri restano numeri; virgola decimale all’italiana; testo non numerico rifiutato', () => {
    const f = field({ type: 'number', config: { integerOnly: false } });
    expect(valueFromDraft(f, '42')).toEqual({ ok: true, value: 42 });
    expect(valueFromDraft(f, '12,5')).toEqual({ ok: true, value: 12.5 });
    expect(valueFromDraft(f, '-3')).toEqual({ ok: true, value: -3 });
    expect(valueFromDraft(f, '')).toEqual({ ok: true, value: null });
    for (const bad of ['dodici', '1e3', '1 000', '12,5,1', '0x10']) {
      expect(valueFromDraft(f, bad).ok, bad).toBe(false);
    }
  });

  it('numero: rispetta minimo, massimo e "solo interi" con la regola del contratto', () => {
    const f = field({ type: 'number', config: { min: 0, max: 10, integerOnly: true } });
    expect(valueFromDraft(f, '5').ok).toBe(true);
    expect(valueFromDraft(f, '11').ok).toBe(false);
    expect(valueFromDraft(f, '-1').ok).toBe(false);
    expect(valueFromDraft(f, '2,5').ok).toBe(false);
  });

  it('sì/no: tre stati, "non indicato" non è "no"', () => {
    const f = field({ type: 'boolean', config: {} });
    expect(valueFromDraft(f, 'true')).toEqual({ ok: true, value: true });
    expect(valueFromDraft(f, 'false')).toEqual({ ok: true, value: false });
    expect(valueFromDraft(f, '')).toEqual({ ok: true, value: null });
    expect(draftFromValue(f, false)).toBe('false');
    expect(draftFromValue(f, null)).toBe('');
  });

  it('testo: rifilato, vuoto = null; URL e date validati', () => {
    expect(valueFromDraft(field({ type: 'text', config: {} }), '  Cardiologia ')).toEqual({
      ok: true,
      value: 'Cardiologia',
    });
    expect(valueFromDraft(field({ type: 'text', config: {} }), '   ')).toEqual({
      ok: true,
      value: null,
    });
    expect(valueFromDraft(field({ type: 'text', config: { maxLength: 3 } }), 'abcd').ok).toBe(
      false,
    );
    const url = field({ type: 'url', config: {} });
    expect(valueFromDraft(url, 'https://example.com').ok).toBe(true);
    expect(valueFromDraft(url, 'javascript:alert(1)').ok).toBe(false);
    const date = field({ type: 'date', config: {} });
    expect(valueFromDraft(date, '2026-12-01').ok).toBe(true);
    expect(valueFromDraft(date, '2026-02-30').ok).toBe(false);
  });

  it('scelte: conservano ID stabili; opzione sconosciuta rifiutata; elenco vuoto = null', () => {
    const single = field({ type: 'single_select', config: { options } });
    expect(valueFromDraft(single, 'o2')).toEqual({ ok: true, value: 'o2' });
    expect(valueFromDraft(single, 'Notte').ok).toBe(false); // l'etichetta non è un ID
    expect(valueFromDraft(single, '')).toEqual({ ok: true, value: null });
    const multi = field({ type: 'multi_select', config: { options } });
    expect(valueFromDraft(multi, ['o1', 'o2'])).toEqual({ ok: true, value: ['o1', 'o2'] });
    expect(valueFromDraft(multi, [])).toEqual({ ok: true, value: null });
    expect(valueFromDraft(multi, ['o9']).ok).toBe(false);
  });
});

describe('confronto e presentazione', () => {
  it('sameValue: le scelte multiple sono insiemi', () => {
    expect(sameValue(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameValue(['a'], ['a', 'b'])).toBe(false);
    expect(sameValue(null, null)).toBe(true);
    expect(sameValue(0, null)).toBe(false);
    expect(sameValue(false, null)).toBe(false);
  });

  it('displayValue mostra i nomi delle opzioni, non gli ID', () => {
    const multi = field({ type: 'multi_select', config: { options } });
    expect(displayValue(multi, ['o1', 'o2'])).toBe('Giorno, Notte');
    expect(displayValue(field({ type: 'boolean', config: {} }), false)).toBe('No');
    expect(displayValue(multi, null)).toBe('—');
  });
});
