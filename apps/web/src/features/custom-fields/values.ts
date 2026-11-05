import {
  validateCustomFieldValue,
  type CustomField,
  type CustomFieldValue,
} from '@meet-roulette/schemas';

/**
 * Bozza di un valore nel modulo: sempre testo (o elenco di ID per la scelta multipla), anche per
 * numeri e sì/no, dove la stringa vuota significa "nessun valore". Funzioni pure e testate.
 */
export type FieldDraft = string | string[];

export const FIELD_TYPE_LABELS = {
  text: 'Testo breve',
  long_text: 'Testo lungo',
  number: 'Numero',
  date: 'Data',
  boolean: 'Sì / No',
  single_select: 'Scelta singola',
  multi_select: 'Scelta multipla',
  url: 'Indirizzo web',
} as const satisfies Record<CustomField['type'], string>;

export function draftFromValue(field: CustomField, value: CustomFieldValue): FieldDraft {
  switch (field.type) {
    case 'multi_select':
      return Array.isArray(value) ? value : [];
    case 'boolean':
      return typeof value === 'boolean' ? String(value) : '';
    default:
      return value === null || Array.isArray(value) ? '' : String(value);
  }
}

export type DraftResult = { ok: true; value: CustomFieldValue } | { ok: false; message: string };

/** Converte la bozza nel valore tipizzato e lo verifica con la STESSA regola del server. */
export function valueFromDraft(field: CustomField, draft: FieldDraft): DraftResult {
  let value: CustomFieldValue;
  switch (field.type) {
    case 'multi_select':
      value = Array.isArray(draft) && draft.length > 0 ? draft : null;
      break;
    case 'boolean':
      value = draft === 'true' ? true : draft === 'false' ? false : null;
      break;
    case 'number': {
      const text = typeof draft === 'string' ? draft.trim() : '';
      if (text === '') {
        value = null;
        break;
      }
      // Accetta la virgola decimale all'italiana; niente esponenti, spazi o separatori di migliaia.
      if (!/^-?\d+([.,]\d+)?$/.test(text)) return { ok: false, message: 'Inserisci un numero' };
      value = Number(text.replace(',', '.'));
      break;
    }
    case 'single_select':
      value = typeof draft === 'string' && draft !== '' ? draft : null;
      break;
    default: {
      const text = typeof draft === 'string' ? draft.trim() : '';
      value = text === '' ? null : text;
    }
  }
  const checked = validateCustomFieldValue(field, value);
  return checked.success
    ? { ok: true, value: checked.value }
    : { ok: false, message: checked.message };
}

/** Uguaglianza di valori (le scelte multiple sono insiemi: l'ordine non conta). */
export function sameValue(a: CustomFieldValue, b: CustomFieldValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000');
  }
  return a === b;
}

/** Testo leggibile di un valore (per l'anteprima compatta): etichette delle opzioni, non gli ID. */
export function displayValue(field: CustomField, value: CustomFieldValue): string {
  if (value === null) return '—';
  if (field.type === 'boolean') return value ? 'Sì' : 'No';
  if (field.type === 'single_select' || field.type === 'multi_select') {
    const label = (id: string) => field.config.options.find((o) => o.id === id)?.label ?? id;
    return Array.isArray(value) ? value.map(label).join(', ') : label(String(value));
  }
  return String(value);
}
